// Panel access tier. Resolved server-side at login (app/api/auth-tier) and
// re-derived from the password on every proxied request — the stored value
// only selects which view to render, never what the server permits.
export type AccessTier = 'admin' | 'mod'

export interface ServerConfig {
  serverIp: string
  restApiPort: string
  gamePort: string
  adminPassword: string
  accessTier?: AccessTier
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

// Sanitized payload served by the unauthenticated /api/public-view route and
// consumed by the /view page. Shared so the two sides cannot drift apart —
// only the fields named here ever go public (no worldguid, IPs, IDs, or ping).
export interface PublicPlayer {
  name: string
  level: number
  location_x: number
  location_y: number
}

export interface PublicSnapshot {
  info: Pick<ServerInfo, 'servername' | 'description' | 'version'>
  metrics: ServerMetrics
  players: PublicPlayer[]
  generatedAt: number
}

export interface FpsSample {
  timestamp: number
  fps: number
}

export interface PlayerActivityEvent {
  timestamp: number
  type: 'join' | 'leave'
  name: string
}

export interface PlayerActivityPayload {
  available: boolean
  events: PlayerActivityEvent[]
  updatedAt: number | null
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
