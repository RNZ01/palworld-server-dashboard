// Standalone read of the server-side FPS ring (lib/fps-sampler.ts).
// The panel itself consumes the ring via /api/server-snapshot since 2026-07-14;
// this route stays as a direct, panel-authenticated view for scripting/debug.
import { NextRequest, NextResponse } from 'next/server'
import { classifyPassword, tierForClass } from '@/lib/access-tier'
import { clientIp, isLockedOut, recordFailure } from '@/lib/rate-limit'
import { DEMO_MODE, demoFpsHistory } from '@/lib/demo-mode'
import { PALWORLD_PROXY_HEADERS } from '@/lib/palworld'
import { readFpsRing } from '@/lib/fps-ring'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

  return NextResponse.json(DEMO_MODE ? demoFpsHistory() : await readFpsRing())
}
