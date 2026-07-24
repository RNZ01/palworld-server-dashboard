// Next.js instrumentation hook — register() runs once per server process at
// startup and is skipped during `next build`. It hosts the opt-in in-process
// FPS and player-activity samplers. Every gate is checked BEFORE its dynamic
// import, so disabled samplers cost zero memory and zero CPU.
export async function register(): Promise<void> {
  // The samplers poll the game's REST API and write local files — Node only.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Demo mode serves canned data and never starts the samplers
  // (same check as lib/demo-mode.ts, inlined to keep this module import-free).
  if (process.env.DEMO_MODE === '1') return

  const enabled = (name: string) =>
    ['1', 'true'].includes((process.env[name] ?? '').trim().toLowerCase())

  if (enabled('PALWORLD_FPS_SAMPLER')) {
    const { startFpsSampler } = await import('@/lib/fps-sampler')
    startFpsSampler()
  }

  if (enabled('PALWORLD_PLAYER_ACTIVITY')) {
    const { startPlayerActivitySampler } = await import('@/lib/player-activity')
    startPlayerActivitySampler()
  }
}
