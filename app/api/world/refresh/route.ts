import { writeFile } from 'node:fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { classifyPassword, tierForClass } from '@/lib/access-tier'
import { DEMO_MODE } from '@/lib/demo-mode'
import { PALWORLD_PROXY_HEADERS } from '@/lib/palworld'
import { clientIp, isLockedOut, recordFailure } from '@/lib/rate-limit'
import { WORLD_REFRESH_REQUEST_PATH } from '@/lib/world-files'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

function adminGate(request: NextRequest): NextResponse | null {
  const ip = clientIp(request)
  if (isLockedOut(ip)) {
    return json({ error: 'Too many attempts. Try again later.' }, 429)
  }

  const presented = request.headers.get(PALWORLD_PROXY_HEADERS.adminPassword) ?? ''
  const passwordClass = classifyPassword(presented)
  if (passwordClass === 'unknown') {
    recordFailure(ip)
    return json({ error: 'Unauthorized' }, 401)
  }
  if (tierForClass(passwordClass) !== 'admin') {
    return json({ error: 'Forbidden: world refresh is admin-only' }, 403)
  }
  return null
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

export async function POST(request: NextRequest) {
  const denied = adminGate(request)
  if (denied) return denied

  const requestedAt = new Date().toISOString()
  if (DEMO_MODE) {
    return json({ success: true, requested_at: requestedAt })
  }

  try {
    await writeFile(
      WORLD_REFRESH_REQUEST_PATH,
      JSON.stringify({ requested_at: requestedAt, by: 'panel' }),
      { flag: 'wx', mode: 0o660 },
    )
  } catch (error) {
    if (isErrnoException(error) && error.code === 'EEXIST') {
      return json({ error: 'refresh already pending' }, 409)
    }
    console.error('Failed to queue world refresh:', error)
    return json({ error: 'failed to queue refresh' }, 500)
  }

  return json({ success: true, requested_at: requestedAt })
}
