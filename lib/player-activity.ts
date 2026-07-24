// SERVER-ONLY. Polls Palworld's player list while the dashboard is running
// and keeps a small persistent join/leave ledger for the admin panel.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { PlayerActivityEvent, PlayerActivityPayload } from './types'

const POLL_MS = 15_000
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const MAX_EVENTS = 10_000
const MAX_RESPONSE_EVENTS = 500
const HTTP_TIMEOUT_MS = 4_000

type TrackedPlayer = { name: string; playerId: string; userId: string }
type SamplerState = 'init' | 'ok' | 'down' | 'unauthorized' | 'write-error'

interface SamplerConfig {
  playersUrl: string
  authHeader: string
  historyFile: string
  tmpFile: string
}

function playerKey(player: TrackedPlayer): string {
  return player.userId || player.playerId || player.name
}

export function diffPlayerActivity(
  previous: TrackedPlayer[],
  current: TrackedPlayer[],
  timestamp: number
): PlayerActivityEvent[] {
  const previousKeys = new Set(previous.map(playerKey))
  const currentKeys = new Set(current.map(playerKey))

  return [
    ...current
      .filter((player) => !previousKeys.has(playerKey(player)))
      .map((player) => ({ timestamp, type: 'join' as const, name: player.name })),
    ...previous
      .filter((player) => !currentKeys.has(playerKey(player)))
      .map((player) => ({ timestamp, type: 'leave' as const, name: player.name })),
  ]
}

function sanitizeEvents(raw: unknown, now = Date.now()): PlayerActivityEvent[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter((event): event is PlayerActivityEvent => {
      if (typeof event !== 'object' || event === null) return false
      const candidate = event as { timestamp?: unknown; type?: unknown; name?: unknown }
      return (
        typeof candidate.timestamp === 'number' &&
        Number.isFinite(candidate.timestamp) &&
        candidate.timestamp <= now &&
        now - candidate.timestamp <= RETENTION_MS &&
        (candidate.type === 'join' || candidate.type === 'leave') &&
        typeof candidate.name === 'string' &&
        candidate.name.length > 0
      )
    })
    .slice(-MAX_EVENTS)
}

function normalizePlayers(raw: unknown): TrackedPlayer[] {
  const players =
    Array.isArray(raw)
      ? raw
      : typeof raw === 'object' && raw !== null && Array.isArray((raw as { players?: unknown }).players)
        ? (raw as { players: unknown[] }).players
        : []

  return players.flatMap((player) => {
    if (typeof player !== 'object' || player === null) return []
    const candidate = player as {
      name?: unknown
      nickname?: unknown
      playerId?: unknown
      player_uid?: unknown
      playerUid?: unknown
      userId?: unknown
      user_id?: unknown
    }
    const rawName = candidate.name ?? candidate.nickname
    const name = typeof rawName === 'string' ? rawName.trim() : ''
    if (!name) return []
    return [{
      name,
      playerId: String(candidate.playerId ?? candidate.player_uid ?? candidate.playerUid ?? ''),
      userId: String(candidate.userId ?? candidate.user_id ?? ''),
    }]
  })
}

function resolveConfig(): SamplerConfig | null {
  const password = process.env.PALWORLD_ADMIN_PASSWORD || process.env.PALWORLD_REAL_ADMIN_PASSWORD || ''
  if (!password) {
    console.error('[player-activity] PALWORLD_ADMIN_PASSWORD is not set - sampler not started')
    return null
  }

  const restUrl = (process.env.PALWORLD_REST_URL ?? 'http://127.0.0.1:8212').replace(/\/+$/, '')
  const historyFile = process.env.PALWORLD_PLAYER_ACTIVITY_FILE ?? './data/player-activity.json'
  return {
    playersUrl: `${restUrl}/v1/api/players`,
    authHeader: `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`,
    historyFile,
    tmpFile: join(dirname(historyFile), `.${basename(historyFile)}.tmp`),
  }
}

async function readPayload(historyFile: string): Promise<PlayerActivityPayload> {
  try {
    const raw = await readFile(/* turbopackIgnore: true */ historyFile, 'utf8')
    const parsed = JSON.parse(raw) as { updatedAt?: unknown; events?: unknown }
    return {
      available: true,
      events: sanitizeEvents(parsed.events),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : null,
    }
  } catch {
    return { available: false, events: [], updatedAt: null }
  }
}

export async function readPlayerActivity(): Promise<PlayerActivityPayload> {
  const historyFile = process.env.PALWORLD_PLAYER_ACTIVITY_FILE ?? './data/player-activity.json'
  const payload = await readPayload(historyFile)
  return { ...payload, events: payload.events.slice(-MAX_RESPONSE_EVENTS) }
}

async function writeHistory(events: PlayerActivityEvent[], now: number, cfg: SamplerConfig): Promise<void> {
  await mkdir(dirname(cfg.historyFile), { recursive: true })
  await writeFile(cfg.tmpFile, JSON.stringify({ updatedAt: now, events }), { mode: 0o644 })
  await rename(cfg.tmpFile, cfg.historyFile)
}

async function fetchPlayers(cfg: SamplerConfig): Promise<{ players: TrackedPlayer[] | null; state: SamplerState }> {
  try {
    const response = await fetch(cfg.playersUrl, {
      headers: { Accept: 'application/json', Authorization: cfg.authHeader },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!response.ok) {
      return { players: null, state: response.status === 401 ? 'unauthorized' : 'down' }
    }
    return { players: normalizePlayers(await response.json()), state: 'ok' }
  } catch {
    return { players: null, state: 'down' }
  }
}

function noteTransition(previous: SamplerState, current: SamplerState): SamplerState {
  if (current === previous) return previous
  if (current === 'ok') {
    console.log(previous === 'init' ? '[player-activity] sampling' : '[player-activity] sampling resumed')
  } else if (current === 'unauthorized') {
    console.log('[player-activity] REST 401 - check PALWORLD_ADMIN_PASSWORD; retrying')
  } else if (current === 'down') {
    console.log('[player-activity] REST unreachable - sampling paused')
  } else if (current === 'write-error') {
    console.error('[player-activity] cannot write history file; retrying')
  }
  return current
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms).unref())
}

async function runLoop(cfg: SamplerConfig): Promise<void> {
  const stored = await readPayload(cfg.historyFile)
  let events = stored.events
  let pendingWrite = !stored.available
  let previousPlayers: TrackedPlayer[] | null = null
  let state: SamplerState = 'init'

  for (;;) {
    const result = await fetchPlayers(cfg)
    if (!result.players) {
      previousPlayers = null
      state = noteTransition(state, result.state)
      await sleep(POLL_MS)
      continue
    }

    const now = Date.now()
    const eventCountBeforePrune = events.length
    const pruned = sanitizeEvents(events, now)
    const newEvents = previousPlayers ? diffPlayerActivity(previousPlayers, result.players, now) : []
    events = [...pruned, ...newEvents].slice(-MAX_EVENTS)
    pendingWrite ||= newEvents.length > 0 || pruned.length !== eventCountBeforePrune
    previousPlayers = result.players

    if (pendingWrite) {
      try {
        await writeHistory(events, now, cfg)
        pendingWrite = false
        state = noteTransition(state, 'ok')
      } catch {
        state = noteTransition(state, 'write-error')
      }
    } else {
      state = noteTransition(state, 'ok')
    }

    await sleep(POLL_MS)
  }
}

let started = false

export function startPlayerActivitySampler(): void {
  if (started) return
  started = true

  const config = resolveConfig()
  if (!config) return

  void runLoop(config).catch((error: unknown) => {
    console.error(`[player-activity] fatal: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`)
  })
}
