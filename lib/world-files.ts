import { join } from 'node:path'

export const WORLD_JSON_DIR = process.env.PALWORLD_WORLD_JSON_DIR ?? '/run/palworld-saveparse'
export const WORLD_JSON_PATH = join(WORLD_JSON_DIR, 'world.json')
export const WORLD_STATUS_PATH = join(WORLD_JSON_DIR, 'status.json')
export const WORLD_REFRESH_REQUEST_PATH = '/run/palworld/saveparse.request'
