// SERVER-ONLY. Shared reader for the FPS ring maintained by
// palworld-fps-sampler.service (5s cadence, atomic writes). Used by
// /api/server-snapshot (the panel's single 15s poll) and /api/fps-history
// (standalone read — kept for scripting/debug).
import { readFile } from 'node:fs/promises'
import type { FpsSample } from '@/lib/types'

const HISTORY_FILE = process.env.PALWORLD_FPS_HISTORY_FILE ?? '/run/palworld-metrics/fps-history.json'
// The sampler (FPS_WINDOW_MINUTES) is the source of truth for the window and
// stamps it into the ring file as `windowMs`; we honor that value rather than a
// hardcoded window, so raising FPS_WINDOW_MINUTES widens the history the panel
// shows. Fall back to the sampler's own default (60min) when the field is
// missing/invalid, and clamp to the sampler's documented 5-1440min range.
const FPS_RING_DEFAULT_WINDOW_MS = 60 * 60 * 1000
const FPS_RING_MIN_WINDOW_MS = 5 * 60 * 1000
const FPS_RING_MAX_WINDOW_MS = 1440 * 60 * 1000

function resolveWindowMs(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return FPS_RING_DEFAULT_WINDOW_MS
  }
  return Math.min(Math.max(raw, FPS_RING_MIN_WINDOW_MS), FPS_RING_MAX_WINDOW_MS)
}

export interface FpsRingPayload {
  available: boolean
  samples: FpsSample[]
  updatedAt: number | null
  windowMs: number
}

function sanitizeSamples(raw: unknown, now: number, windowMs: number): FpsSample[] {
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
      now - candidate.timestamp <= windowMs
    )
  })
}

export async function readFpsRing(): Promise<FpsRingPayload> {
  try {
    const raw = await readFile(/* turbopackIgnore: true */ HISTORY_FILE, 'utf8')
    const parsed = JSON.parse(raw) as { updatedAt?: unknown; samples?: unknown; windowMs?: unknown }
    const now = Date.now()
    const windowMs = resolveWindowMs(parsed.windowMs)

    return {
      available: true,
      samples: sanitizeSamples(parsed.samples, now, windowMs),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : null,
      windowMs,
    }
  } catch {
    // Sampler not running yet / file missing (e.g. right after reboot) —
    // an empty history, not an error.
    return { available: false, samples: [], updatedAt: null, windowMs: FPS_RING_DEFAULT_WINDOW_MS }
  }
}
