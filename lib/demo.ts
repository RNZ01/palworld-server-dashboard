import type { FpsSample, Player, ServerInfo, ServerMetrics } from './types'

export const demoConfig = {
  serverIp: 'demo.local',
  restApiPort: '8212',
  gamePort: '8211',
  adminPassword: 'demo',
  accessTier: 'admin' as const,
}

export const demoServerInfo: ServerInfo = {
  version: '0.6.6-demo',
  servername: 'Demo Palworld Server',
  description: 'Read-only sample data for the public dashboard demo.',
  worldguid: 'demo-world',
}

export const demoPlayers: Player[] = [
  { name: 'LamballLarry', accountName: 'lamball', playerId: '00000065000000000000000000000000', userId: 'steam_demo_101', ip: '127.0.0.1', ping: 28, location_x: 1450, location_y: -820, level: 42 },
  { name: 'CattivaCore', accountName: 'cattiva', playerId: '00000066000000000000000000000000', userId: 'steam_demo_102', ip: '127.0.0.1', ping: 44, location_x: -360, location_y: 980, level: 31 },
  { name: 'SparkitOps', accountName: 'sparkit', playerId: '00000067000000000000000000000000', userId: 'steam_demo_103', ip: '127.0.0.1', ping: 19, location_x: 720, location_y: 260, level: 55 },
]

export const demoMetrics: ServerMetrics = {
  serverfps: 58,
  currentplayernum: demoPlayers.length,
  maxplayernum: 32,
  serverframetime: 17.2,
  uptime: 345600,
  days: 128,
  basecampnum: 8,
}

export const demoSettings = {
  ServerName: demoServerInfo.servername,
  Difficulty: 'Normal',
  ServerPlayerMaxNum: demoMetrics.maxplayernum,
  DeathPenalty: 'Item',
  BaseCampMaxNum: demoMetrics.basecampnum,
  RESTAPIEnabled: true,
}

export function getDemoFpsHistory(now = Date.now()): FpsSample[] {
  return Array.from({ length: 120 }, (_, index) => {
    const phase = index / 8
    return {
      timestamp: now - (119 - index) * 30_000,
      fps: Math.round((55 + Math.sin(phase) * 4 + Math.cos(phase / 2) * 2) * 10) / 10,
    }
  })
}
