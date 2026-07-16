// SERVER-ONLY. Shared reader for the 1h FPS ring maintained by
// palworld-fps-sampler.service (5s cadence, atomic writes). Used by
// /api/server-snapshot (the panel's single 15s poll) and /api/fps-history
// (standalone read — kept for scripting/debug).
import { readFile } from 'node:fs/promises'
import type { FpsSample } from '@/lib/types'

const HISTORY_FILE = process.env.PALWORLD_FPS_HISTORY_FILE ?? '/run/palworld-metrics/fps-history.json'
const FPS_RING_WINDOW_MS = 1 * 60 * 60 * 1000 // keep in sync with the sampler's windowMs

export interface FpsRingPayload {
  available: boolean
  samples: FpsSample[]
  updatedAt: number | null
  windowMs: number
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
      now - candidate.timestamp <= FPS_RING_WINDOW_MS
    )
  })
}

export async function readFpsRing(): Promise<FpsRingPayload> {
  try {
    const raw = await readFile(/* turbopackIgnore: true */ HISTORY_FILE, 'utf8')
    const parsed = JSON.parse(raw) as { updatedAt?: unknown; samples?: unknown }
    const now = Date.now()

    return {
      available: true,
      samples: sanitizeSamples(parsed.samples, now),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : null,
      windowMs: FPS_RING_WINDOW_MS,
    }
  } catch {
    // Sampler not running yet / file missing (e.g. right after reboot) —
    // an empty history, not an error.
    return { available: false, samples: [], updatedAt: null, windowMs: FPS_RING_WINDOW_MS }
  }
}
