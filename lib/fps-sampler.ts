// SERVER-ONLY. In-process server-side FPS history sampler.
//
// The dashboard's FPS histogram reads a rolling ring of samples maintained by
// this module — NOT collected in the browser. That means the history is always
// populated for the full window (default: the last hour) even when nobody has
// the panel open, hidden browser tabs can't thin the data out, and server
// downtime shows up as an honest gap instead of an interpolated line.
//
// This module is reachable ONLY through the gated dynamic import in
// instrumentation.ts: when PALWORLD_FPS_SAMPLER is unset it is never
// evaluated, so a disabled sampler costs no memory or CPU. It replaces the
// external sampler (scripts/fps-sampler/palworld-fps-sampler.py) that
// previously ran as a sidecar container or systemd service.
//
// Configuration (environment variables):
//   PALWORLD_REST_URL          Base URL of the Palworld REST API
//                              (default: http://127.0.0.1:8212)
//   PALWORLD_ADMIN_PASSWORD    The game's REST AdminPassword (required;
//                              PALWORLD_REAL_ADMIN_PASSWORD is an accepted alias)
//   PALWORLD_FPS_HISTORY_FILE  Ring file path, written here and read by
//                              lib/fps-ring.ts — one variable for both ends,
//                              so writer and reader can never diverge
//                              (default: ./data/fps-history.json)
//   FPS_SAMPLE_SECONDS         Poll cadence in seconds (default 5, clamped 1-60)
//   FPS_WINDOW_MINUTES         History window in minutes (default 60, clamped 5-1440)
//   FPS_SANE_MAX               Discard samples above this fps as invalid (default 65).
//                              Palworld's engine frame limiter caps serverfps at 60,
//                              but /metrics briefly reports the free-running tick
//                              (1000+) while the world is still loading after a
//                              restart; one such sample blows out the histogram's
//                              auto-scaled axis. Raise only if you deliberately
//                              raise the server frame cap.
//
// Behavior notes:
//   - Writes are atomic (tmp file + rename): readers never see a torn file.
//   - The ring is pruned to the window on every write and capped in sample count.
//   - REST unreachable (server stopped/restarting) => nothing is appended; the
//     dashboard renders that span as a gap. The loop keeps polling and logs
//     only on state transitions, so logs stay quiet.
//   - Existing ring data is reloaded on startup, so restarting the dashboard
//     does not wipe the window (the ring file lives in the persisted data dir).
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { FpsSample } from '@/lib/types'

const HTTP_TIMEOUT_MS = 4_000

// init: before the first successful poll. write-error is split out from down so
// an unwritable ring path (the classic misconfiguration: read-only mount, wrong
// ownership) is named in the logs instead of masquerading as a REST outage.
type SamplerState = 'init' | 'ok' | 'down' | 'unauthorized' | 'write-error'

interface SamplerConfig {
  metricsUrl: string
  authHeader: string
  historyFile: string
  tmpFile: string
  cadenceMs: number
  windowMs: number
  saneMax: number
  maxSamples: number
}

function envInt(name: string, fallback: number, lo: number, hi: number): number {
  // Whole numbers only — a malformed value ("1.5", "1e3") falls back to the
  // safe default rather than being silently truncated to something surprising.
  const raw = (process.env[name] ?? '').trim()
  if (!/^[+-]?\d+$/.test(raw)) return fallback
  return Math.max(lo, Math.min(hi, Number.parseInt(raw, 10)))
}

function resolveConfig(): SamplerConfig | null {
  // || (not ??): a defined-but-empty PALWORLD_ADMIN_PASSWORD still falls
  // through to the alias, matching the retired sidecar's behavior.
  const password = process.env.PALWORLD_ADMIN_PASSWORD || process.env.PALWORLD_REAL_ADMIN_PASSWORD || ''
  if (!password) {
    console.error(
      '[fps-sampler] PALWORLD_ADMIN_PASSWORD (or PALWORLD_REAL_ADMIN_PASSWORD) is not set — sampler not started'
    )
    return null
  }

  const restUrl = (process.env.PALWORLD_REST_URL ?? 'http://127.0.0.1:8212').replace(/\/+$/, '')
  // Default must stay in sync with the reader's default in lib/fps-ring.ts.
  const historyFile = process.env.PALWORLD_FPS_HISTORY_FILE ?? './data/fps-history.json'
  const cadenceMs = envInt('FPS_SAMPLE_SECONDS', 5, 1, 60) * 1000
  const windowMs = envInt('FPS_WINDOW_MINUTES', 60, 5, 1440) * 60_000

  return {
    metricsUrl: `${restUrl}/v1/api/metrics`,
    authHeader: `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`,
    historyFile,
    tmpFile: join(dirname(historyFile), `.${basename(historyFile)}.tmp`),
    cadenceMs,
    windowMs,
    saneMax: envInt('FPS_SANE_MAX', 65, 1, 100_000),
    maxSamples: Math.floor(windowMs / cadenceMs) + 1,
  }
}

async function loadExisting(cfg: SamplerConfig): Promise<FpsSample[]> {
  try {
    const raw = await readFile(/* turbopackIgnore: true */ cfg.historyFile, 'utf8')
    const parsed = JSON.parse(raw) as { samples?: unknown }
    if (!Array.isArray(parsed.samples)) return []
    return parsed.samples.filter((sample): sample is FpsSample => {
      if (typeof sample !== 'object' || sample === null) return false
      const candidate = sample as { timestamp?: unknown; fps?: unknown }
      return typeof candidate.timestamp === 'number' && typeof candidate.fps === 'number'
    })
  } catch {
    // No ring yet (first run) or unreadable — start empty.
    return []
  }
}

function prune(samples: FpsSample[], nowMs: number, cfg: SamplerConfig): FpsSample[] {
  return samples.filter((s) => nowMs - s.timestamp <= cfg.windowMs).slice(-cfg.maxSamples)
}

async function writeRing(samples: FpsSample[], nowMs: number, cfg: SamplerConfig): Promise<void> {
  const payload = JSON.stringify({
    updatedAt: nowMs,
    windowMs: cfg.windowMs,
    cadenceMs: cfg.cadenceMs,
    samples,
  })
  await mkdir(dirname(cfg.historyFile), { recursive: true })
  await writeFile(cfg.tmpFile, payload, { mode: 0o644 })
  await rename(cfg.tmpFile, cfg.historyFile)
}

interface TickResult {
  samples: FpsSample[]
  state: SamplerState
  detail?: string
}

async function sampleOnce(cfg: SamplerConfig, samples: FpsSample[], state: SamplerState): Promise<TickResult> {
  const nowMs = Date.now()
  let metrics: unknown
  try {
    const resp = await fetch(cfg.metricsUrl, {
      headers: { Accept: 'application/json', Authorization: cfg.authHeader },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!resp.ok) {
      return { samples, state: resp.status === 401 ? 'unauthorized' : 'down' }
    }
    metrics = await resp.json()
  } catch {
    return { samples, state: 'down' } // server stopped / REST unreachable — honest gap
  }

  const fps = (metrics as { serverfps?: unknown } | null)?.serverfps
  if (typeof fps !== 'number' || !Number.isFinite(fps)) {
    console.warn(`[fps-sampler] WARN: /metrics response missing serverfps: ${JSON.stringify(metrics)?.slice(0, 200)}`)
    return { samples, state }
  }

  if (fps > cfg.saneMax) {
    // Never drop silently — log each discard so real anomalies can't hide.
    console.log(
      `[fps-sampler] DROP: serverfps=${fps} > FPS_SANE_MAX=${cfg.saneMax} (boot-window artifact) — sample discarded`
    )
    return { samples, state: 'ok' }
  }

  const next = prune([...samples, { timestamp: nowMs, fps }], nowMs, cfg)
  try {
    await writeRing(next, nowMs, cfg)
  } catch (error) {
    return { samples: next, state: 'write-error', detail: error instanceof Error ? error.message : String(error) }
  }
  return { samples: next, state: 'ok' }
}

function noteTransition(cfg: SamplerConfig, prev: SamplerState, next: SamplerState, detail?: string): SamplerState {
  if (next === prev) return prev
  if (next === 'ok') {
    console.log(prev === 'init' ? '[fps-sampler] REST reachable — sampling' : '[fps-sampler] REST reachable — sampling resumed')
  } else if (next === 'down') {
    console.log('[fps-sampler] REST unreachable (server down?) — sampling paused, gap will show in history')
  } else if (next === 'unauthorized') {
    console.log('[fps-sampler] REST 401 — check PALWORLD_ADMIN_PASSWORD; retrying')
  } else if (next === 'write-error') {
    console.error(
      `[fps-sampler] cannot write ${cfg.historyFile} (${detail}) — check PALWORLD_FPS_HISTORY_FILE points somewhere writable; retrying`
    )
  }
  return next
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    // unref: the sampler must never keep a shutting-down server process alive.
    setTimeout(resolve, ms).unref()
  })
}

async function runLoop(cfg: SamplerConfig): Promise<void> {
  let samples = await loadExisting(cfg)
  console.log(
    `[fps-sampler] started (target ${cfg.metricsUrl}, loaded ${samples.length} existing samples, ` +
      `cadence ${cfg.cadenceMs / 1000}s, window ${cfg.windowMs / 60_000}min -> ${cfg.historyFile})`
  )

  let state: SamplerState = 'init'
  // Monotonic alignment (performance.now, immune to wall-clock jumps): no
  // drift accumulation across ticks.
  const origin = performance.now()
  let tick = 0

  for (;;) {
    const result = await sampleOnce(cfg, samples, state)
    samples = result.samples
    state = noteTransition(cfg, state, result.state, result.detail)

    tick += 1
    const delay = origin + tick * cfg.cadenceMs - performance.now()
    if (delay > 0) {
      await sleep(delay)
    } else {
      // Fell behind (suspend/stall) — realign instead of burst-firing.
      tick = Math.floor((performance.now() - origin) / cfg.cadenceMs)
    }
  }
}

let started = false

/**
 * Start the in-process FPS sampler. Idempotent: a second call (e.g. another
 * dev worker evaluating the module) is a no-op, so at most one poll loop runs
 * per process. Never throws — a misconfiguration logs and leaves the
 * dashboard itself untouched.
 */
export function startFpsSampler(): void {
  if (started) return
  started = true

  const cfg = resolveConfig()
  if (!cfg) return

  void runLoop(cfg).catch((error: unknown) => {
    console.error(`[fps-sampler] fatal: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`)
  })
}
