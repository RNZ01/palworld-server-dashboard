import { readFile } from 'node:fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { classifyPassword, tierForClass } from '@/lib/access-tier'
import { DEMO_MODE, demoWorld, demoWorldStatus } from '@/lib/demo-mode'
import { PALWORLD_PROXY_HEADERS } from '@/lib/palworld'
import { clientIp, isLockedOut, recordFailure } from '@/lib/rate-limit'
import type { WorldData, WorldParseStatus } from '@/lib/types'
import { WORLD_JSON_PATH, WORLD_STATUS_PATH } from '@/lib/world-files'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const STALE_AFTER_MS = 2 * 60 * 60 * 1000

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
    return json({ error: 'Forbidden: world data is admin-only' }, 403)
  }
  return null
}

async function readJson(path: string): Promise<unknown | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as unknown
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isWorldPlayer(value: unknown) {
  return isRecord(value) &&
    typeof value.uid === 'string' &&
    typeof value.nickname === 'string' &&
    isFiniteNumber(value.level) &&
    isFiniteNumber(value.pal_count) &&
    isNullableString(value.last_seen) &&
    isNullableString(value.session_started) &&
    isNullableFiniteNumber(value.last_x) &&
    isNullableFiniteNumber(value.last_y)
}

function isWorldGuildMember(value: unknown) {
  return isRecord(value) &&
    typeof value.uid === 'string' &&
    typeof value.nickname === 'string' &&
    isNullableString(value.last_seen)
}

function isWorldGuild(value: unknown) {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    isFiniteNumber(value.base_level) &&
    isFiniteNumber(value.base_count) &&
    isNullableString(value.admin_uid) &&
    Array.isArray(value.members) &&
    value.members.every(isWorldGuildMember)
}

function isWorldBase(value: unknown) {
  return isRecord(value) &&
    typeof value.id === 'string' &&
    isNullableFiniteNumber(value.x) &&
    isNullableFiniteNumber(value.y) &&
    isNullableFiniteNumber(value.area) &&
    typeof value.guild_id === 'string' &&
    typeof value.guild === 'string' &&
    isFiniteNumber(value.guild_base_level)
}

function isWorldData(value: unknown): value is WorldData {
  return isRecord(value) &&
    value.schema_version === 2 &&
    typeof value.world_guid === 'string' &&
    typeof value.parsed_at === 'string' &&
    Number.isFinite(Date.parse(value.parsed_at)) &&
    typeof value.source_saved_at === 'string' &&
    isFiniteNumber(value.duration_s) &&
    Array.isArray(value.bases) && value.bases.every(isWorldBase) &&
    Array.isArray(value.guilds) && value.guilds.every(isWorldGuild) &&
    Array.isArray(value.players) && value.players.every(isWorldPlayer)
}

function isWorldParseStatus(value: unknown): value is WorldParseStatus {
  return isRecord(value) &&
    typeof value.ok === 'boolean' &&
    (value.error === null || typeof value.error === 'string') &&
    typeof value.finished_at === 'string' &&
    isNullableFiniteNumber(value.duration_s) &&
    isNullableFiniteNumber(value.players) &&
    isNullableFiniteNumber(value.bases) &&
    isNullableFiniteNumber(value.pal_count)
}

export async function GET(request: NextRequest) {
  const denied = adminGate(request)
  if (denied) return denied

  if (DEMO_MODE) {
    const world = demoWorld()
    return json({ available: true, world, status: demoWorldStatus(world), stale: false })
  }

  const [worldValue, statusValue] = await Promise.all([
    readJson(WORLD_JSON_PATH),
    readJson(WORLD_STATUS_PATH),
  ])
  const status = isWorldParseStatus(statusValue) ? statusValue : undefined

  if (!isWorldData(worldValue)) {
    return json({ available: false, ...(status ? { status } : {}), stale: false })
  }

  const stale = Date.now() - Date.parse(worldValue.parsed_at) > STALE_AFTER_MS
  return json({ available: true, world: worldValue, status: status ?? null, stale })
}
