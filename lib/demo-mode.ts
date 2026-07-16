import { demoMetrics as demoMetricsValue, demoPlayers, demoServerInfo, demoSettings, getDemoFpsHistory } from '@/lib/demo'
import type { AccessTier, WorldData, WorldParseStatus } from '@/lib/types'

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

export function demoWorld(now = Date.now()): WorldData {
  const isoAgo = (minutes: number) => new Date(now - minutes * 60_000).toISOString()

  return {
    schema_version: 2,
    world_guid: 'DEMO-WORLD-0001',
    parsed_at: new Date(now).toISOString(),
    source_saved_at: isoAgo(2),
    duration_s: 4.2,
    bases: [
      { id: 'demo-base-1', x: -266_405, y: 314_530, area: 3500, guild_id: 'demo-guild-pals', guild: 'Pal Patrol', guild_base_level: 24 },
      { id: 'demo-base-2', x: 128, y: -137_770, area: 3500, guild_id: 'demo-guild-pals', guild: 'Pal Patrol', guild_base_level: 24 },
      { id: 'demo-base-3', x: -684_482, y: -362_040, area: 3500, guild_id: 'demo-guild-tree', guild: 'Treehouse Crew', guild_base_level: 18 },
      { id: 'demo-base-4', x: 348_500, y: -550_000, area: 3500, guild_id: 'demo-guild-tree', guild: 'Treehouse Crew', guild_base_level: 18 },
    ],
    guilds: [
      {
        id: 'demo-guild-pals',
        name: 'Pal Patrol',
        base_level: 24,
        base_count: 2,
        admin_uid: '00000067000000000000000000000000',
        members: [
          { uid: '00000067000000000000000000000000', nickname: 'SparkitOps', last_seen: isoAgo(1) },
          { uid: '00000065000000000000000000000000', nickname: 'LamballLarry', last_seen: isoAgo(1) },
          { uid: '00000068000000000000000000000000', nickname: 'MossandaMain', last_seen: isoAgo(47) },
        ],
      },
      {
        id: 'demo-guild-tree',
        name: 'Treehouse Crew',
        base_level: 18,
        base_count: 2,
        admin_uid: '00000066000000000000000000000000',
        members: [
          { uid: '00000066000000000000000000000000', nickname: 'CattivaCore', last_seen: isoAgo(1) },
          { uid: '00000069000000000000000000000000', nickname: 'FoxparksFan', last_seen: isoAgo(190) },
          { uid: '0000006A000000000000000000000000', nickname: 'DepressoDesk', last_seen: isoAgo(1440) },
        ],
      },
    ],
    players: [
      { uid: '00000067000000000000000000000000', nickname: 'SparkitOps', level: 55, pal_count: 318, last_seen: isoAgo(1), session_started: isoAgo(86), last_x: 74_000, last_y: 112_000 },
      { uid: '00000065000000000000000000000000', nickname: 'LamballLarry', level: 42, pal_count: 205, last_seen: isoAgo(1), session_started: isoAgo(124), last_x: 126_000, last_y: -74_000 },
      { uid: '00000066000000000000000000000000', nickname: 'CattivaCore', level: 31, pal_count: 144, last_seen: isoAgo(1), session_started: isoAgo(33), last_x: -82_000, last_y: 54_000 },
      { uid: '00000068000000000000000000000000', nickname: 'MossandaMain', level: 49, pal_count: 276, last_seen: isoAgo(47), session_started: isoAgo(235), last_x: -144_116, last_y: -38_782 },
      { uid: '00000069000000000000000000000000', nickname: 'FoxparksFan', level: 28, pal_count: 119, last_seen: isoAgo(190), session_started: isoAgo(420), last_x: 198_467, last_y: -232_753 },
      { uid: '0000006A000000000000000000000000', nickname: 'DepressoDesk', level: 17, pal_count: 63, last_seen: isoAgo(1440), session_started: null, last_x: -368, last_y: -137_225 },
    ],
  }
}

export function demoWorldStatus(world: WorldData): WorldParseStatus {
  return {
    ok: true,
    error: null,
    finished_at: world.parsed_at,
    duration_s: world.duration_s,
    players: world.players.length,
    bases: world.bases.length,
    pal_count: world.players.reduce((total, player) => total + player.pal_count, 0),
  }
}
