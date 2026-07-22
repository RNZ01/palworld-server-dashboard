// Next.js instrumentation hook — register() runs once per server process at
// startup and is skipped during `next build`. It hosts the opt-in in-process
// FPS sampler (lib/fps-sampler.ts). Every gate is checked BEFORE the dynamic
// import so that with the sampler disabled its module is never evaluated:
// unset PALWORLD_FPS_SAMPLER costs zero memory and zero CPU.
export async function register(): Promise<void> {
  // The sampler polls the game's REST API and writes the ring file — Node only.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Demo mode serves canned FPS history and never reads the ring
  // (same check as lib/demo-mode.ts, inlined to keep this module import-free).
  if (process.env.DEMO_MODE === '1') return

  const gate = (process.env.PALWORLD_FPS_SAMPLER ?? '').trim().toLowerCase()
  if (gate !== '1' && gate !== 'true') return

  // Static specifier: traced into the standalone build, but evaluated only here.
  const { startFpsSampler } = await import('@/lib/fps-sampler')
  startFpsSampler()
}
