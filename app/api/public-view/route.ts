// PUBLIC, UNAUTHENTICATED, READ-ONLY snapshot for the /view status page.
//
// ─── SECURITY BOUNDARY ───────────────────────────────────────────────────────
// This is the only route reachable without a panel password, so it holds to a
// stricter contract than the authed routes:
//
//   • OPT-IN: disabled unless PUBLIC_VIEW_ENABLED=true — a fork or default
//     deploy exposes nothing new. Disabled → plain 404.
//   • GET-only, and NO client input is read: no query params, no headers, no
//     body. Nothing a caller sends influences the upstream request.
//   • ALLOWLIST serialization: the response is rebuilt field-by-field below.
//     Player IPs, user/player IDs, account names, ping, the world GUID, and
//     server settings never enter the payload — adding a field here must be a
//     deliberate edit, not an upstream schema change leaking through.
//   • Upstream shielding: one snapshot is cached for PUBLIC_VIEW_CACHE_SECONDS
//     and concurrent misses share a single in-flight fetch, so public traffic
//     costs at most ~1 upstream request per TTL. That matters because REST
//     /players is synchronized with the game thread on PalServer.
//   • Errors return a generic message — upstream details stay in server logs.
//
// The panel's real REST admin password is used server-side exactly like the
// authed proxy: pinned upstream, injected here, never sent to the browser.
import { Buffer } from 'node:buffer'
import { createHash, randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { DEMO_MODE, demoMetrics, demoPlayers, demoServerInfo } from '@/lib/demo-mode'
import { normalizePlayersPayload } from '@/lib/palworld'
import type { Player, PublicPlayer, PublicSnapshot } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function envFlag(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

function isEnabled(): boolean {
  return envFlag(process.env.PUBLIC_VIEW_ENABLED)
}

function anonymizeNames(): boolean {
  return envFlag(process.env.PUBLIC_VIEW_ANONYMIZE_NAMES)
}

function cacheTtlMs(): number {
  const parsed = Number.parseInt(process.env.PUBLIC_VIEW_CACHE_SECONDS ?? '', 10)
  const seconds = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 5), 60) : 10
  return seconds * 1000
}

// PUBLIC_VIEW_ANONYMIZE_NAMES: real names are replaced BEFORE the payload is
// built, so they never enter the snapshot (or any fronting cache). The tag is
// a salted hash of the player's id — stable across polls so map markers keep
// their label, but non-reversible (Steam ids are enumerable, so an unsalted
// hash could be brute-forced back). The salt is random per process: pseudonyms
// survive refreshes but intentionally rotate on server restart.
const anonymizationSalt = randomBytes(16).toString('hex')

function pseudonym(player: Player): string {
  const identity = player.userId || player.playerId || player.name
  const tag = createHash('sha256').update(`${anonymizationSalt}:${identity}`).digest('hex').slice(0, 4)
  return `Player-${tag}`
}

// Allowlist mappers: every field is picked and coerced explicitly.
function toPublicPlayers(payload: unknown): PublicPlayer[] {
  const anonymize = anonymizeNames()
  return normalizePlayersPayload(payload).map((player) => ({
    name: anonymize ? pseudonym(player) : player.name,
    level: player.level,
    location_x: player.location_x,
    location_y: player.location_y,
  }))
}

function toPublicInfo(payload: unknown): PublicSnapshot['info'] {
  const info = (payload ?? {}) as Record<string, unknown>
  return {
    servername: String(info.servername ?? ''),
    description: String(info.description ?? ''),
    version: String(info.version ?? ''),
  }
}

function toPublicMetrics(payload: unknown): PublicSnapshot['metrics'] {
  const metrics = (payload ?? {}) as Record<string, unknown>
  const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
  return {
    serverfps: num(metrics.serverfps),
    currentplayernum: num(metrics.currentplayernum),
    maxplayernum: num(metrics.maxplayernum),
    serverframetime: num(metrics.serverframetime),
    uptime: num(metrics.uptime),
    days: num(metrics.days),
    basecampnum: num(metrics.basecampnum),
  }
}

// Hard timeout: with single-flight, one hung upstream response would otherwise
// pin `inFlight` and stall EVERY public request until undici's own timeouts
// (minutes). Aborting keeps the negative cache in charge of a wedged server.
const UPSTREAM_TIMEOUT_MS = 10_000

async function fetchUpstream(baseUrl: URL, endpoint: string, password: string) {
  const response = await fetch(new URL(`/v1/api/${endpoint}`, baseUrl), {
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`upstream ${endpoint} responded with ${response.status}`)
  }

  return response.json() as Promise<unknown>
}

async function buildSnapshot(): Promise<PublicSnapshot> {
  const pinned = new URL(process.env.PALWORLD_REST_URL ?? 'http://127.0.0.1:8212')
  const gameAdminPassword =
    process.env.PALWORLD_ADMIN_PASSWORD ?? process.env.PALWORLD_REAL_ADMIN_PASSWORD ?? ''

  if (!gameAdminPassword) {
    throw new Error('missing PALWORLD_ADMIN_PASSWORD')
  }

  const [info, metrics, players] = await Promise.all([
    fetchUpstream(pinned, 'info', gameAdminPassword),
    fetchUpstream(pinned, 'metrics', gameAdminPassword),
    fetchUpstream(pinned, 'players', gameAdminPassword),
  ])

  return {
    info: toPublicInfo(info),
    metrics: toPublicMetrics(metrics),
    players: toPublicPlayers(players),
    generatedAt: Date.now(),
  }
}

// Cache + single-flight: anonymous traffic can never fan out to the upstream.
// Failures are negative-cached briefly so a down game server is not hammered.
const ERROR_HOLD_MS = 5_000
let cachedSnapshot: { payload: PublicSnapshot; expiresAt: number } | null = null
let errorHoldUntil = 0
let inFlight: Promise<PublicSnapshot> | null = null

function snapshotResponse(payload: PublicSnapshot, maxAgeMs: number) {
  return NextResponse.json(payload, {
    headers: {
      // Lets a fronting reverse proxy/CDN absorb public load. max-age is the
      // snapshot's REMAINING lifetime, not the full TTL — otherwise a CDN
      // hitting near expiry would serve data up to ~2x TTL old.
      'Cache-Control': `public, max-age=${Math.max(1, Math.ceil(maxAgeMs / 1000))}`,
    },
  })
}

export async function GET() {
  if (!isEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (DEMO_MODE) {
    return NextResponse.json({
      info: toPublicInfo(demoServerInfo()),
      metrics: toPublicMetrics(demoMetrics()),
      players: toPublicPlayers(demoPlayers),
      generatedAt: Date.now(),
    } satisfies PublicSnapshot)
  }

  const now = Date.now()
  const ttlMs = cacheTtlMs()

  if (cachedSnapshot && cachedSnapshot.expiresAt > now) {
    return snapshotResponse(cachedSnapshot.payload, cachedSnapshot.expiresAt - now)
  }

  if (errorHoldUntil > now && !inFlight) {
    return NextResponse.json(
      { error: 'Game server is unreachable.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  try {
    if (!inFlight) {
      inFlight = buildSnapshot().finally(() => {
        inFlight = null
      })
    }
    const payload = await inFlight
    cachedSnapshot = { payload, expiresAt: Date.now() + ttlMs }
    errorHoldUntil = 0
    return snapshotResponse(payload, ttlMs)
  } catch (error) {
    console.error('Public view snapshot error:', error)
    errorHoldUntil = Date.now() + ERROR_HOLD_MS
    return NextResponse.json(
      { error: 'Game server is unreachable.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
