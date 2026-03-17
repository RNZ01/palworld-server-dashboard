export interface ServerConfig {
  serverIp: string
  restApiPort: string
  adminPassword: string
}

export interface Player {
  name: string
  accountName: string
  playerId: string
  userId: string
  ip: string
  ping: number
  location_x: number
  location_y: number
  level: number
}

export interface ServerInfo {
  version: string
  servername: string
  description: string
  worldguid: string
}

export interface ServerMetrics {
  serverfps: number
  currentplayernum: number
  maxplayernum: number
  serverframetime: number
  uptime: number
  days: number
  basecampnum: number
}

export interface FpsSample {
  timestamp: number
  fps: number
}

export interface ConsoleLog {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
  timestamp: Date
  endpoint: string
  rawResponse?: string
}

export interface BannedPlayer {
  name: string
  steamId: string
  bannedAt: string
}
