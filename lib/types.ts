export interface ServerConfig {
  serverIp: string
  restApiPort: string
  adminPassword: string
}

export interface Player {
  name: string
  playerId: string
  oddsId: string
  oddsName: string
  level: number
  ping: number
}

export interface ServerInfo {
  version: string
  serverName: string
  description: string
}

export interface ServerMetrics {
  serverfps: number
  currentplayernum: number
  maxplayernum: number
  serverframetime: number
  uptime: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  timestamp: Date
}

export interface ConsoleLog {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
  timestamp: Date
  endpoint: string
}
