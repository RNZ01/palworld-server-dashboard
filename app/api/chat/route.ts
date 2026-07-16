import { Buffer } from 'node:buffer'
import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { classifyPassword } from '@/lib/access-tier'
import { getAnnounceEchoes, recordAnnounceEcho } from '@/lib/announce-echo'
import { CHAT_LOG_FILE, readChatLog } from '@/lib/chat-source'
import { DEMO_MODE } from '@/lib/demo-mode'
import { clientIp, isLockedOut, recordFailure } from '@/lib/rate-limit'
import { PALWORLD_PROXY_HEADERS } from '@/lib/palworld'

const run = promisify(execFile)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Live game chat + presence, parsed from the server's stdout log (Palworld's
// REST API has no chat-read endpoint). ADMIN-tier only — this returns player
// messages, so mod/unknown are rejected like the proxy. The log is read from one
// of three sources, in order of precedence:
//   1. PALWORLD_CHAT_LOG_FILE — a plain log file (or glob). No systemd/Docker
//      required; for Kubernetes/containerd (Talos), Podman, etc. See lib/chat-source.
//   2. PALWORLD_DOCKER_CONTAINER — `docker logs` (needs the Docker socket).
//   3. journalctl -u PALWORLD_SYSTEMD_UNIT — the default (needs Linux + systemd
//      and the panel's OS user in the systemd-journal group).
const SYSTEMD_UNIT = process.env.PALWORLD_SYSTEMD_UNIT ?? 'palworld'
const DOCKER_CONTAINER = process.env.PALWORLD_DOCKER_CONTAINER
const CHAT_RE = /^\[([^\]]+)\]\s+\[CHAT\]\s+(.*)$/
const JOIN_RE = /^\[([^\]]+)\]\s+\[LOG\]\s+(.+?)\s+(?:[\d.:]+\s+)?(?:joined|connected) the server\./
const LEAVE_RE = /^\[([^\]]+)\]\s+\[LOG\]\s+(.+?)\s+left the server\./

type ChatEvent = { type: 'chat' | 'join' | 'leave'; ts: string; name: string; text?: string }

export async function GET(request: NextRequest) {
  const ip = clientIp(request)
  if (isLockedOut(ip)) return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 })
  // Header-only: never accept the panel password from the query string, which
  // would leak it into reverse-proxy access logs, browser history, and Referer.
  const pw = request.headers.get(PALWORLD_PROXY_HEADERS.adminPassword) ?? ''
  const cls = classifyPassword(pw)
  if (cls === 'unknown') recordFailure(ip)
  if (cls !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (DEMO_MODE) {
    return NextResponse.json({
      events: [
        { type: 'join', ts: new Date(Date.now() - 600_000).toISOString(), name: 'LamballLarry' },
        { type: 'chat', ts: new Date(Date.now() - 420_000).toISOString(), name: 'CattivaCore', text: 'Demo server online.' },
        { type: 'chat', ts: new Date(Date.now() - 120_000).toISOString(), name: 'SparkitOps', text: 'Try announce, kick, ban, and restart safely.' },
        ...getAnnounceEchoes(),
      ],
    })
  }

  let out = ''
  try {
    if (CHAT_LOG_FILE) {
      // readChatLog already NUL-scrubs and strips any CRI prefix.
      out = await readChatLog()
    } else {
      const { stdout, stderr } = DOCKER_CONTAINER
        ? await run('docker', ['logs', '--since', '3h', DOCKER_CONTAINER], { maxBuffer: 8 * 1024 * 1024, timeout: 5000 })
        : await run(
            'journalctl',
            ['-u', SYSTEMD_UNIT, '-o', 'cat', '--since', '-3h', '--no-pager'],
            { maxBuffer: 8 * 1024 * 1024, timeout: 5000 },
          )
      out = `${stdout}\n${stderr}`.replaceAll('\0', '')
    }
  } catch {
    return NextResponse.json({ events: [] })
  }

  const events: ChatEvent[] = []
  for (const rawLine of out.split('\n')) {
    const line = rawLine.trim()
    let m = CHAT_RE.exec(line)
    if (m) {
      const rest = m[2]!.trim()
      const nm = /^<([^>]+)>\s*(.*)$/.exec(rest)
      events.push({ type: 'chat', ts: m[1]!, name: nm ? nm[1]! : '', text: nm ? nm[2]! : rest })
      continue
    }
    m = JOIN_RE.exec(line)
    if (m) { events.push({ type: 'join', ts: m[1]!, name: m[2]!.trim() }); continue }
    m = LEAVE_RE.exec(line)
    if (m) { events.push({ type: 'leave', ts: m[1]!, name: m[2]!.trim() }) }
  }
  const merged = [...events, ...getAnnounceEchoes()].sort((a, b) => a.ts.localeCompare(b.ts))
  return NextResponse.json({ events: merged.slice(-120) })
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  if (isLockedOut(ip)) return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 })
  const pw = request.headers.get(PALWORLD_PROXY_HEADERS.adminPassword) ?? ''
  const cls = classifyPassword(pw)
  if (cls === 'unknown') recordFailure(ip)
  if (cls !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let message = ''
  try {
    const body = (await request.json()) as { message?: unknown }
    message = typeof body.message === 'string' ? body.message.trim() : ''
  } catch {
    message = ''
  }
  if (!message || message.length > 1000) {
    return NextResponse.json({ error: 'Invalid message' }, { status: 400 })
  }

  if (DEMO_MODE) {
    recordAnnounceEcho(message)
    return NextResponse.json({ success: true })
  }

  const pinned = new URL(process.env.PALWORLD_REST_URL ?? 'http://127.0.0.1:8212')
  const gameAdminPassword =
    process.env.PALWORLD_ADMIN_PASSWORD ?? process.env.PALWORLD_REAL_ADMIN_PASSWORD ?? ''
  if (!gameAdminPassword) {
    return NextResponse.json(
      { error: 'Server proxy is not configured (missing PALWORLD_ADMIN_PASSWORD).' },
      { status: 500 },
    )
  }

  try {
    const response = await fetch(new URL('/v1/api/announce', pinned), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`admin:${gameAdminPassword}`).toString('base64')}`,
      },
      body: JSON.stringify({ message }),
      cache: 'no-store',
    })
    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json(
        { error: `Server responded with ${response.status}: ${text}` },
        { status: response.status },
      )
    }
  } catch (error) {
    console.error('Announce error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect to server' },
      { status: 500 },
    )
  }

  recordAnnounceEcho(message)
  return NextResponse.json({ success: true })
}
