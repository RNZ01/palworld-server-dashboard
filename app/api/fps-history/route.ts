// Server-side FPS history endpoint (owner order 2026-07-13): the panel no
// longer collects its own FPS history — palworld-fps-sampler.service maintains
// a rolling exactly-1h ring at /run/palworld-metrics/fps-history.json
// (5s cadence, atomic writes), independent of any browser. This route is a
// read-only, panel-authenticated view of that file. It never touches the game
// REST API, so it adds zero game-thread load.
import { readFile } from 'node:fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { classifyPassword, tierForClass } from '@/lib/access-tier'
import { clientIp, isLockedOut, recordFailure } from '@/lib/rate-limit'
import { PALWORLD_PROXY_HEADERS } from '@/lib/palworld'
import type { FpsSample } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HISTORY_FILE = process.env.PALWORLD_FPS_HISTORY_FILE ?? '/run/palworld-metrics/fps-history.json'
const WINDOW_MS = 1 * 60 * 60 * 1000 // keep in sync with the sampler's windowMs

interface RingFile {
  updatedAt?: number
  windowMs?: number
  cadenceMs?: number
  samples?: unknown
}

function sanitizeSamples(raw: unknown, now: number): FpsSample[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.filter((sample): sample is FpsSample => {
    if (typeof sample !== 'object' || sample === null) {
      return false
    }
    const candidate = sample as { timestamp?: unknown; fps?: unknown }
    return (
      typeof candidate.timestamp === 'number' &&
      Number.isFinite(candidate.timestamp) &&
      typeof candidate.fps === 'number' &&
      Number.isFinite(candidate.fps) &&
      now - candidate.timestamp <= WINDOW_MS
    )
  })
}

export async function GET(request: NextRequest) {
  // Same auth + brute-force posture as the palworld proxy route: header-only
  // panel password, tier verified per request, failures rate-limited.
  const ip = clientIp(request)
  if (isLockedOut(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const presented = request.headers.get(PALWORLD_PROXY_HEADERS.adminPassword) ?? ''
  const tier = tierForClass(classifyPassword(presented))
  if (tier === 'invalid') {
    recordFailure(ip)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const raw = await readFile(HISTORY_FILE, 'utf8')
    const parsed = JSON.parse(raw) as RingFile
    const now = Date.now()

    return NextResponse.json({
      available: true,
      samples: sanitizeSamples(parsed.samples, now),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : null,
      windowMs: WINDOW_MS,
    })
  } catch {
    // Sampler not running yet / file missing (e.g. right after reboot) —
    // an empty history, not an error.
    return NextResponse.json({ available: false, samples: [], updatedAt: null, windowMs: WINDOW_MS })
  }
}
