// Combined per-tick snapshot (owner order 2026-07-14): the panel makes ONE
// request every 15s and gets metrics + players (+ the server-side FPS ring for
// admin tier) together, instead of polling separate endpoints on separate
// timers. Upstream, PalServer has no combined REST endpoint, so the two reads
// (/metrics + /players — both mod-allowlisted data) run in parallel here.
// REST cost with the panel open: 2 calls / 15s = 0.13 req/s (was 0.3 req/s
// with the separate 5s metrics + 10s roster polls).
import { Buffer } from 'node:buffer'
import { NextRequest, NextResponse } from 'next/server'
import { classifyPassword, tierForClass } from '@/lib/access-tier'
import { clientIp, isLockedOut, recordFailure } from '@/lib/rate-limit'
import { DEMO_MODE, demoFpsHistory, demoMetrics, demoPlayers } from '@/lib/demo-mode'
import { PALWORLD_PROXY_HEADERS } from '@/lib/palworld'
import { readFpsRing } from '@/lib/fps-ring'
import { readPlayerActivity } from '@/lib/player-activity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function fetchUpstream(baseUrl: URL, endpoint: string, password: string) {
  const response = await fetch(new URL(`/v1/api/${endpoint}`, baseUrl), {
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`upstream ${endpoint} responded with ${response.status}`)
  }

  return response.json() as Promise<unknown>
}

export async function GET(request: NextRequest) {
  // Same auth + brute-force posture as the palworld proxy route.
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

  if (DEMO_MODE) {
    return NextResponse.json({
      metrics: demoMetrics(),
      players: { players: demoPlayers },
      ...(tier === 'admin' ? { fpsHistory: demoFpsHistory() } : {}),
    })
  }

  // Upstream target is PINNED server-side (same posture as the proxy route);
  // the game's real REST admin password comes from env and never reaches the client.
  const pinned = new URL(process.env.PALWORLD_REST_URL ?? 'http://127.0.0.1:8212')
  const gameAdminPassword =
    process.env.PALWORLD_ADMIN_PASSWORD ?? process.env.PALWORLD_REAL_ADMIN_PASSWORD ?? ''

  if (!gameAdminPassword) {
    return NextResponse.json(
      { error: 'Server proxy is not configured (missing PALWORLD_ADMIN_PASSWORD).' },
      { status: 500 }
    )
  }

  try {
    const [metrics, players, fpsHistory, playerActivity] = await Promise.all([
      fetchUpstream(pinned, 'metrics', gameAdminPassword),
      fetchUpstream(pinned, 'players', gameAdminPassword),
      // FPS history is an admin-view feature; the mod tier gets metrics+players only.
      tier === 'admin' ? readFpsRing() : Promise.resolve(null),
      tier === 'admin' ? readPlayerActivity() : Promise.resolve(null),
    ])

    return NextResponse.json({
      metrics,
      players,
      ...(fpsHistory ? { fpsHistory } : {}),
      ...(playerActivity ? { playerActivity } : {}),
    })
  } catch (error) {
    console.error('Snapshot error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect to server' },
      { status: 502 }
    )
  }
}
