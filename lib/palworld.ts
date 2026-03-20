import type { Player, ServerConfig } from './types'

interface RawPlayer extends Partial<Player> {
  nickname?: string
  player_uid?: string
  playerUid?: string
  user_id?: string
  account_name?: string
  locationX?: number
  locationY?: number
}

function extractPlayerList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray((payload as { players?: unknown[] } | null)?.players)) {
    return (payload as { players: unknown[] }).players
  }

  return []
}

export type PalworldApiConfig = Pick<ServerConfig, 'serverIp' | 'restApiPort' | 'adminPassword'>

export const PALWORLD_PROXY_HEADERS = {
  serverIp: 'x-palworld-server-ip',
  serverPort: 'x-palworld-server-port',
  adminPassword: 'x-palworld-admin-password',
} as const

export function buildPalworldProxyPath(endpoint: string) {
  return `/api/palworld/${endpoint.replace(/^\/+/, '')}`
}

export function buildPalworldProxyHeaders(config: PalworldApiConfig): HeadersInit {
  return {
    [PALWORLD_PROXY_HEADERS.serverIp]: config.serverIp.trim(),
    [PALWORLD_PROXY_HEADERS.serverPort]: config.restApiPort.trim(),
    [PALWORLD_PROXY_HEADERS.adminPassword]: config.adminPassword,
  }
}

export function getPlayerKey(player: Pick<Player, 'name' | 'playerId' | 'userId'>) {
  return player.userId || player.playerId || player.name
}

export function normalizePlayersPayload(payload: unknown): Player[] {
  return extractPlayerList(payload)
    .map((item) => {
      const player = item as RawPlayer

      return {
        name: player.name ?? player.nickname ?? 'Unknown Player',
        accountName: player.accountName ?? player.account_name ?? '',
        playerId: player.playerId ?? player.player_uid ?? player.playerUid ?? '',
        userId: player.userId ?? player.user_id ?? '',
        ip: player.ip ?? '',
        ping: Number(player.ping ?? 0),
        location_x: Number(player.location_x ?? player.locationX ?? 0),
        location_y: Number(player.location_y ?? player.locationY ?? 0),
        level: Number(player.level ?? 0),
      }
    })
}
