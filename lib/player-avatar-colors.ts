const AVATAR_COLOR_PALETTE = [
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#14b8a6',
  '#0ea5e9',
  '#6366f1',
  '#d946ef',
] as const

export const PLAYER_AVATAR_COLORS_STORAGE_KEY = 'player-avatar-colors'

function getRandomIndex(maxExclusive: number) {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const randomBuffer = new Uint32Array(1)
    globalThis.crypto.getRandomValues(randomBuffer)
    return randomBuffer[0] % maxExclusive
  }

  return Math.floor(Math.random() * maxExclusive)
}

function readAvatarColorMap() {
  if (typeof window === 'undefined') {
    return {} as Record<string, string>
  }

  const raw = window.localStorage.getItem(PLAYER_AVATAR_COLORS_STORAGE_KEY)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const entries = Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

function writeAvatarColorMap(map: Record<string, string>) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PLAYER_AVATAR_COLORS_STORAGE_KEY, JSON.stringify(map))
}

function pickColor(existingMap: Record<string, string>) {
  const usedColors = new Set(Object.values(existingMap))
  const availableColors = AVATAR_COLOR_PALETTE.filter((color) => !usedColors.has(color))

  if (availableColors.length > 0) {
    return availableColors[getRandomIndex(availableColors.length)]
  }

  return AVATAR_COLOR_PALETTE[getRandomIndex(AVATAR_COLOR_PALETTE.length)]
}

export function getPlayerAvatarColor(playerId: string) {
  const normalizedId = playerId.trim()
  if (!normalizedId) {
    return '#06b6d4'
  }

  const avatarColorMap = readAvatarColorMap()
  const existingColor = avatarColorMap[normalizedId]
  if (existingColor) {
    return existingColor
  }

  const color = pickColor(avatarColorMap)
  avatarColorMap[normalizedId] = color
  writeAvatarColorMap(avatarColorMap)

  return color
}
