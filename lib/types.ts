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

export interface FpsSample {
  timestamp: number
  fps: number
}

export interface WorldPlayer {
  uid: string
  nickname: string
  level: number
  pal_count: number
  last_seen: string | null
  session_started: string | null
  last_x: number | null
  last_y: number | null
}

export interface WorldGuildMember {
  uid: string
  nickname: string
  last_seen: string | null
}

export interface WorldGuild {
  id: string
  name: string
  base_level: number
  base_count: number
  admin_uid: string | null
  members: WorldGuildMember[]
}

export interface WorldBase {
  id: string
  x: number | null
  y: number | null
  area: number | null
  guild_id: string
  guild: string
  guild_base_level: number
}

export interface WorldData {
  schema_version: 2
  world_guid: string
  parsed_at: string
  source_saved_at: string
  duration_s: number
  bases: WorldBase[]
  guilds: WorldGuild[]
  players: WorldPlayer[]
}

export interface WorldParseStatus {
  ok: boolean
  error: string | null
  finished_at: string
  duration_s: number | null
  players: number | null
  bases: number | null
  pal_count: number | null
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
