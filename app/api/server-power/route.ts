import { NextRequest, NextResponse } from 'next/server'
import { writeFile, rename } from 'node:fs/promises'
import { classifyPassword, tierForClass } from '@/lib/access-tier'
import { DEMO_MODE } from '@/lib/demo-mode'
import { clientIp, isLockedOut, recordFailure } from '@/lib/rate-limit'
import { PALWORLD_PROXY_HEADERS } from '@/lib/palworld'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Power on/off cannot go through the game REST API: starting a stopped server is
// impossible over REST (the process is down), and a clean stop must survive the
// unit's Restart=on-failure policy. Like /api/server-restart, this route only
// drops a request flag into the shared spool; the root-owned host worker
// (palworld-restart.path/.service) runs the actual `systemctl start|stop`. The
// web tier holds NO sudo — it writes a file it already owns. INERT until the
// host units are installed.
const REQUEST_PATH = process.env.PALWORLD_RESTART_REQUEST_PATH ?? '/run/palworld/restart.request'

function presentedPassword(request: NextRequest) {
  return request.headers.get(PALWORLD_PROXY_HEADERS.adminPassword) ?? ''
}

function adminGate(request: NextRequest): NextResponse | null {
  const ip = clientIp(request)
  if (isLockedOut(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }
  const passwordClass = classifyPassword(presentedPassword(request))
  if (passwordClass === 'unknown') {
    recordFailure(ip)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (tierForClass(passwordClass) !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: server power is admin-only' }, { status: 403 })
  }
  return null
}

export async function POST(request: NextRequest) {
  const denied = adminGate(request)
  if (denied) return denied

  let action = ''
  try {
    const body = (await request.json()) as { action?: unknown }
    if (typeof body.action === 'string') action = body.action
  } catch {
    // fall through to the validation below
  }
  if (action !== 'start' && action !== 'stop') {
    return NextResponse.json({ error: 'Invalid action (expected "start" or "stop")' }, { status: 400 })
  }

  if (DEMO_MODE) {
    return NextResponse.json({ success: true, action })
  }

  try {
    // temp-then-rename so the path-unit never observes a half-written request
    const tmp = `${REQUEST_PATH}.tmp`
    await writeFile(tmp, JSON.stringify({ action, waittime: 0, requestedAt: Date.now() }), { mode: 0o660 })
    await rename(tmp, REQUEST_PATH)
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to queue ${action}: ${error instanceof Error ? error.message : 'unknown error'}` },
      { status: 500 }
    )
  }
  return NextResponse.json({ success: true, action })
}
