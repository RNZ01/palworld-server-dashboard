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

type PalworldApiConfig = Pick<ServerConfig, 'serverIp' | 'restApiPort' | 'adminPassword'>

export function buildPalworldApiUrl(config: PalworldApiConfig, endpoint: string) {
  const params = new URLSearchParams({
    serverIp: config.serverIp,
    serverPort: config.restApiPort,
    adminPassword: config.adminPassword,
  })

  return `/api/palworld/${endpoint.replace(/^\/+/, '')}?${params.toString()}`
}

export function buildGamePortValidationUrl(serverIp: string, gamePort: string) {
  const params = new URLSearchParams({
    serverIp: serverIp.trim(),
    gamePort: gamePort.trim(),
  })

  return `/api/validate-game-port?${params.toString()}`
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
