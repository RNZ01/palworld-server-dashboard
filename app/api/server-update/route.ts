import { NextRequest, NextResponse } from 'next/server'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { classifyPassword, tierForClass } from '@/lib/access-tier'
import { DEMO_MODE } from '@/lib/demo-mode'
import { buildDemoUpdateStatus } from '@/lib/server-update-demo'
import { clientIp, isLockedOut, recordFailure } from '@/lib/rate-limit'
import { PALWORLD_PROXY_HEADERS } from '@/lib/palworld'
import {
  emptyServerUpdateStatus,
  isServerUpdateActive,
  normalizeServerUpdateStatus,
  type ServerUpdateAction,
  type ServerUpdateStatus,
} from '@/lib/server-update'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UPDATE_ENABLED = /^(1|true)$/i.test(process.env.PALWORLD_UPDATE_ENABLED ?? '')
const REQUEST_PATH = process.env.PALWORLD_UPDATE_REQUEST_PATH ?? '/run/palworld/update.request'
const STATUS_PATH = process.env.PALWORLD_UPDATE_STATUS_PATH ?? '/run/palworld/update.status.json'
const MAX_WAIT_SECONDS = 1800

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
    return NextResponse.json({ error: 'Forbidden: server updates are admin-only' }, { status: 403 })
  }
  return null
}

async function atomicWrite(path: string, value: unknown) {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`
  await writeFile(/* turbopackIgnore: true */ tmp, `${JSON.stringify(value)}\n`, { mode: 0o660 })
  await rename(/* turbopackIgnore: true */ tmp, /* turbopackIgnore: true */ path)
}

async function readStatus(): Promise<ServerUpdateStatus> {
  if (DEMO_MODE) return buildDemoUpdateStatus()
  if (!UPDATE_ENABLED) return emptyServerUpdateStatus(false)

  try {
    const parsed = JSON.parse(
      await readFile(/* turbopackIgnore: true */ STATUS_PATH, 'utf8')
    ) as unknown
    return normalizeServerUpdateStatus(parsed, true)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return emptyServerUpdateStatus(true)
    }
    return {
      ...emptyServerUpdateStatus(true),
      phase: 'failed',
      message: `Could not read update status: ${error instanceof Error ? error.message : 'unknown error'}`,
    }
  }
}

export async function GET(request: NextRequest) {
  const denied = adminGate(request)
  if (denied) return denied

  return NextResponse.json(await readStatus(), {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest) {
  const denied = adminGate(request)
  if (denied) return denied

  if (!UPDATE_ENABLED && !DEMO_MODE) {
    return NextResponse.json(
      { error: 'Server update integration is not enabled.' },
      { status: 503 }
    )
  }

  let action: ServerUpdateAction = 'check'
  let waittime = 30
  let message = 'Server update starting. Please reconnect shortly.'

  try {
    const body = (await request.json()) as {
      action?: unknown
      waittime?: unknown
      message?: unknown
    }
    if (body.action === 'update') action = 'update'
    if (typeof body.waittime === 'number' && Number.isFinite(body.waittime)) {
      waittime = Math.max(0, Math.min(MAX_WAIT_SECONDS, Math.floor(body.waittime)))
    }
    if (typeof body.message === 'string' && body.message.trim()) {
      message = body.message.trim().slice(0, 180)
    }
  } catch {
    // Empty or malformed JSON means "check now".
  }

  const current = await readStatus()
  if (isServerUpdateActive(current)) {
    return NextResponse.json(
      { error: `An update operation is already ${current.phase}.`, status: current },
      { status: 409 }
    )
  }

  const requestedAt = Date.now()
  const queued: ServerUpdateStatus = {
    ...current,
    configured: true,
    phase: 'queued',
    message: action === 'update' ? 'Update queued on the server host.' : 'Update check queued on the server host.',
    progress: null,
    requestedAt,
    startedAt: null,
    completedAt: null,
    updatedAt: requestedAt,
  }

  if (DEMO_MODE) {
    return NextResponse.json({ success: true, action, status: queued })
  }

  try {
    // Publish status first. Renaming the request last is the signal consumed by
    // the host path unit, so the worker cannot race with a later "queued" write.
    await atomicWrite(STATUS_PATH, queued)
    await atomicWrite(REQUEST_PATH, { action, waittime, message, requestedAt })
  } catch (error) {
    return NextResponse.json(
      { error: `Failed to queue ${action}: ${error instanceof Error ? error.message : 'unknown error'}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, action, status: queued }, { status: 202 })
}
