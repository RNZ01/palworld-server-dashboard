import { demoMetrics as demoMetricsValue, demoPlayers, demoServerInfo, demoSettings, getDemoFpsHistory } from '@/lib/demo'
import type { AccessTier } from '@/lib/types'

export const DEMO_MODE = process.env.DEMO_MODE === '1'
const DEMO_PASSWORD = 'demo'

export function isDemoPassword(password: string) {
  return DEMO_MODE && password === DEMO_PASSWORD
}

export { demoPlayers }

export function demoMetrics() {
  return demoMetricsValue
}

export function demoFpsHistory() {
  return { samples: getDemoFpsHistory(), windowMs: 60 * 60 * 1000 }
}

export function demoPalworldResponse(endpoint: string, method: string, tier: AccessTier) {
  if (method === 'GET') {
    if (endpoint === 'info') return demoServerInfo
    if (endpoint === 'metrics') return demoMetricsValue
    if (endpoint === 'players') return { players: demoPlayers }
    if (endpoint === 'settings' && tier === 'admin') return demoSettings
  }

  return { success: true, message: `Demo mode: ${method} /${endpoint} accepted, no real server changed.` }
}
