'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { buildPalworldProxyHeaders, buildPalworldProxyPath, normalizePlayersPayload } from './palworld'
import type { ServerConfig, Player, ConsoleLog, ServerInfo, ServerMetrics, BannedPlayer, FpsSample } from './types'

type ConnectionStatus = 'disconnected' | 'checking' | 'connected'

// FPS history is SERVER-SIDE (owner order 2026-07-13): palworld-fps-sampler.service
// maintains the authoritative ring (5s cadence) in /run/palworld-metrics and the
// panel only fetches + displays it — the browser never collects. The window is
// the sampler's (FPS_WINDOW_MINUTES), delivered per-snapshot as `windowMs`; these
// helpers sanitize the fetched payload against whatever window the sampler reports.
const FPS_HISTORY_DEFAULT_WINDOW_MS = 60 * 60 * 1000
const FPS_HISTORY_MIN_WINDOW_MS = 5 * 60 * 1000
const FPS_HISTORY_MAX_WINDOW_MS = 1440 * 60 * 1000
const FPS_SAMPLE_NOMINAL_MS = 5_000 // sampler cadence — bounds the retained sample count

function resolveFpsWindowMs(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return FPS_HISTORY_DEFAULT_WINDOW_MS
  }
  return Math.min(Math.max(raw, FPS_HISTORY_MIN_WINDOW_MS), FPS_HISTORY_MAX_WINDOW_MS)
}

// ONE combined snapshot request (metrics + players + fps history) per tick via
// /api/server-snapshot — no separate metrics/roster polls, no runtime-adjustable
// poll rates. Deployments can tune the cadence at BUILD time via
// NEXT_PUBLIC_SNAPSHOT_POLL_SECONDS (default 15, clamped 5-120).
const parsedSnapshotPollSeconds = Number.parseInt(process.env.NEXT_PUBLIC_SNAPSHOT_POLL_SECONDS ?? '', 10)
const SNAPSHOT_POLL_INTERVAL_MS =
  (Number.isFinite(parsedSnapshotPollSeconds) ? Math.min(Math.max(parsedSnapshotPollSeconds, 5), 120) : 15) * 1000

const LEGACY_FPS_HISTORY_STORAGE_KEY = 'fpsHistory'
const LEGACY_REFRESH_RATE_STORAGE_KEY = 'refreshRateOnlinePlayers'
const DEFAULT_GAME_PORT = '8211'
const ACTIVE_SESSION_STORAGE_KEY = 'activeServerSession'

const STORAGE_KEYS = {
  config: 'serverConfig',
  players: 'onlinePlayers',
  serverInfo: 'serverInfo',
  serverMetrics: 'serverMetrics',
  fpsHistory: 'fpsHistory',
  settings: 'settings',
  bannedPlayers: 'bannedPlayers',
  lastConnectedServer: 'lastConnectedServer',
} as const

const SERVER_STORAGE_KEYS_TO_CLEAR = [
  STORAGE_KEYS.config,
  LEGACY_REFRESH_RATE_STORAGE_KEY,
  STORAGE_KEYS.players,
  STORAGE_KEYS.serverInfo,
  STORAGE_KEYS.serverMetrics,
  STORAGE_KEYS.settings,
  STORAGE_KEYS.bannedPlayers,
  STORAGE_KEYS.lastConnectedServer,
  LEGACY_FPS_HISTORY_STORAGE_KEY,
  ACTIVE_SESSION_STORAGE_KEY,
] as const

function readStorageValue<T>(key: string, fallback: T) {
  const value = localStorage.getItem(key)

  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function writeStorageValue(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

type StoredServerConfig = Omit<ServerConfig, 'gamePort'> & Partial<Pick<ServerConfig, 'gamePort'>>

function normalizeServerConfig(config: StoredServerConfig | ServerConfig | null): ServerConfig | null {
  if (!config) {
    return null
  }

  return {
    serverIp: String(config.serverIp ?? '').trim(),
    restApiPort: String(config.restApiPort ?? '').trim(),
    gamePort: String(config.gamePort ?? DEFAULT_GAME_PORT).trim() || DEFAULT_GAME_PORT,
    adminPassword: String(config.adminPassword ?? ''),
    // View selection only — the proxy re-derives the tier from the password
    // on every request, so a tampered stored tier gains nothing server-side.
    accessTier: config.accessTier === 'mod' ? 'mod' : 'admin',
  }
}

function clearServerStorage() {
  const keysToRemove = Object.keys(localStorage).filter((key) => {
    return SERVER_STORAGE_KEYS_TO_CLEAR.includes(key as typeof SERVER_STORAGE_KEYS_TO_CLEAR[number]) || key.startsWith(`${STORAGE_KEYS.fpsHistory}:`)
  })

  keysToRemove.forEach((key) => {
    localStorage.removeItem(key)
  })
}

function trimFpsHistory(history: FpsSample[], windowMs: number, now = Date.now()) {
  const maxSamples = Math.ceil(windowMs / FPS_SAMPLE_NOMINAL_MS) + 1
  return history
    .filter((sample) => Number.isFinite(sample.timestamp) && Number.isFinite(sample.fps) && now - sample.timestamp <= windowMs)
    .slice(-maxSamples)
}

function createLogId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isActiveSessionStored() {
  return localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY) === '1'
}

interface ServerContextType {
  config: ServerConfig | null
  setConfig: (config: ServerConfig, options?: { rememberMe?: boolean }) => void
  clearConfig: () => void
  isConfigured: boolean
  players: Player[]
  setPlayers: (players: Player[]) => void
  consoleLogs: ConsoleLog[]
  addLog: (log: Omit<ConsoleLog, 'id' | 'timestamp'>) => void
  clearLogs: () => void
  apiCall: <T>(endpoint: string, method?: string, body?: Record<string, unknown>) => Promise<T>
  isLoading: Record<string, boolean>
  serverInfo: ServerInfo | null
  setServerInfo: (info: ServerInfo | null) => void
  serverMetrics: ServerMetrics | null
  setServerMetrics: (metrics: ServerMetrics | null) => void
  fpsHistory: FpsSample[]
  fpsWindowMs: number
  settings: Record<string, unknown> | null
  setSettings: (settings: Record<string, unknown> | null) => void
  fetchAllData: () => Promise<void>
  fetchSnapshot: () => Promise<void>
  bannedPlayers: BannedPlayer[]
  addBannedPlayer: (player: BannedPlayer) => void
  removeBannedPlayer: (steamId: string) => void
  connectionStatus: ConnectionStatus
  lastConnectionError: string | null
  nextSnapshotFetchAt: number | null
  snapshotPollIntervalMs: number
}

interface SnapshotPayload {
  metrics?: ServerMetrics
  players?: unknown
  fpsHistory?: { samples?: FpsSample[]; windowMs?: number }
  error?: string
}

const ServerContext = createContext<ServerContextType | null>(null)

export function useServer() {
  const context = useContext(ServerContext)
  if (!context) {
    throw new Error('useServer must be used within a ServerProvider')
  }
  return context
}

export function ServerProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<ServerConfig | null>(null)
  const [players, setPlayersState] = useState<Player[]>([])
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([])
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({})
  const [isHydrated, setIsHydrated] = useState(false)

  const [serverInfo, setServerInfoState] = useState<ServerInfo | null>(null)
  const [serverMetrics, setServerMetricsState] = useState<ServerMetrics | null>(null)
  const [fpsHistory, setFpsHistoryState] = useState<FpsSample[]>([])
  const [fpsWindowMs, setFpsWindowMs] = useState<number>(FPS_HISTORY_DEFAULT_WINDOW_MS)
  const [settings, setSettingsState] = useState<Record<string, unknown> | null>(null)
  const [bannedPlayers, setBannedPlayersState] = useState<BannedPlayer[]>([])
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [lastConnectionError, setLastConnectionError] = useState<string | null>(null)
  const [nextSnapshotFetchAt, setNextSnapshotFetchAt] = useState<number | null>(null)

  useEffect(() => {
    const storedConfig = normalizeServerConfig(readStorageValue<StoredServerConfig | null>(STORAGE_KEYS.config, null))
    const shouldRestoreActiveSession = isActiveSessionStored()

    // FPS history moved server-side; poll cadence is fixed — scrub stale keys.
    Object.keys(localStorage)
      .filter((key) =>
        key === LEGACY_FPS_HISTORY_STORAGE_KEY ||
        key === LEGACY_REFRESH_RATE_STORAGE_KEY ||
        key.startsWith(`${STORAGE_KEYS.fpsHistory}:`)
      )
      .forEach((key) => localStorage.removeItem(key))

    setConfigState(shouldRestoreActiveSession ? storedConfig : null)
    setPlayersState(normalizePlayersPayload(readStorageValue(STORAGE_KEYS.players, [])))
    setServerInfoState(readStorageValue<ServerInfo | null>(STORAGE_KEYS.serverInfo, null))
    setServerMetricsState(readStorageValue<ServerMetrics | null>(STORAGE_KEYS.serverMetrics, null))
    setSettingsState(readStorageValue<Record<string, unknown> | null>(STORAGE_KEYS.settings, null))
    setBannedPlayersState(readStorageValue<BannedPlayer[]>(STORAGE_KEYS.bannedPlayers, []))

    setIsHydrated(true)
  }, [])

  const setConfig = useCallback((newConfig: ServerConfig, options?: { rememberMe?: boolean }) => {
    const normalizedConfig = normalizeServerConfig(newConfig)
    if (!normalizedConfig) {
      return
    }
    const rememberMe = options?.rememberMe ?? true

    setConfigState(normalizedConfig)
    setConnectionStatus('checking')
    setLastConnectionError(null)
    setFpsHistoryState([]) // repopulated from /api/fps-history on connect

    if (rememberMe) {
      writeStorageValue(STORAGE_KEYS.config, normalizedConfig)
      localStorage.setItem(STORAGE_KEYS.lastConnectedServer, `${normalizedConfig.serverIp}:${normalizedConfig.restApiPort}`)
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, '1')
    } else {
      localStorage.removeItem(STORAGE_KEYS.config)
      localStorage.removeItem(STORAGE_KEYS.lastConnectedServer)
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
    }
  }, [])

  const clearConfig = useCallback(() => {
    setConfigState(null)
    setPlayersState([])
    setConsoleLogs([])
    setIsLoading({})
    setConnectionStatus('disconnected')
    setLastConnectionError(null)
    setServerInfoState(null)
    setServerMetricsState(null)
    setFpsHistoryState([])
    setSettingsState(null)
    setBannedPlayersState([])
    setNextSnapshotFetchAt(null)

    const storedConfigRaw = localStorage.getItem(STORAGE_KEYS.config)
    let rememberedConfig: ServerConfig | null = null

    if (storedConfigRaw) {
      try {
        rememberedConfig = normalizeServerConfig(JSON.parse(storedConfigRaw) as StoredServerConfig)
      } catch {
        rememberedConfig = null
      }
    }

    clearServerStorage()

    if (rememberedConfig) {
      writeStorageValue(STORAGE_KEYS.config, rememberedConfig)
      localStorage.setItem(STORAGE_KEYS.lastConnectedServer, `${rememberedConfig.serverIp}:${rememberedConfig.restApiPort}`)
    }
  }, [])

  const setPlayers = useCallback((newPlayers: Player[]) => {
    const normalizedPlayers = normalizePlayersPayload(newPlayers)
    setPlayersState(normalizedPlayers)
    writeStorageValue(STORAGE_KEYS.players, normalizedPlayers)
  }, [])

  const setServerInfo = useCallback((info: ServerInfo | null) => {
    setServerInfoState(info)
    if (info) {
      writeStorageValue(STORAGE_KEYS.serverInfo, info)
    } else {
      localStorage.removeItem(STORAGE_KEYS.serverInfo)
    }
  }, [])

  const setServerMetrics = useCallback((metrics: ServerMetrics | null) => {
    setServerMetricsState(metrics)
    if (metrics) {
      writeStorageValue(STORAGE_KEYS.serverMetrics, metrics)
    } else {
      localStorage.removeItem(STORAGE_KEYS.serverMetrics)
    }
  }, [])

  const setSettings = useCallback((settings: Record<string, unknown> | null) => {
    setSettingsState(settings)
    if (settings) {
      writeStorageValue(STORAGE_KEYS.settings, settings)
    } else {
      localStorage.removeItem(STORAGE_KEYS.settings)
    }
  }, [])

  const addBannedPlayer = useCallback((player: BannedPlayer) => {
    setBannedPlayersState(prev => {
      const updated = [player, ...prev.filter(p => p.steamId !== player.steamId)]
      writeStorageValue(STORAGE_KEYS.bannedPlayers, updated)
      return updated
    })
  }, [])

  const removeBannedPlayer = useCallback((steamId: string) => {
    setBannedPlayersState(prev => {
      const updated = prev.filter(p => p.steamId !== steamId)
      writeStorageValue(STORAGE_KEYS.bannedPlayers, updated)
      return updated
    })
  }, [])

  const addLog = useCallback((log: Omit<ConsoleLog, 'id' | 'timestamp'>) => {
    const newLog: ConsoleLog = {
      ...log,
      id: createLogId(),
      timestamp: new Date(),
    }
    setConsoleLogs(prev => [newLog, ...prev].slice(0, 100))
  }, [])

  const clearLogs = useCallback(() => {
    setConsoleLogs([])
  }, [])

  const apiCall = useCallback(async <T,>(
    endpoint: string,
    method: string = 'GET',
    body?: Record<string, unknown>
  ): Promise<T> => {
    if (!config) {
      throw new Error('Server not configured')
    }

    setConnectionStatus((current) => (current === 'disconnected' ? 'checking' : current))
    setIsLoading(prev => ({ ...prev, [endpoint]: true }))

    const url = buildPalworldProxyPath(endpoint)

    try {
      const headers = new Headers(buildPalworldProxyHeaders(config))
      headers.set('Accept', 'application/json')

      if (body) {
        headers.set('Content-Type', 'application/json')
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      })

      const responseText = await response.text()
      let data: T
      try {
        data = JSON.parse(responseText) as T
      } catch {
        data = responseText as unknown as T
      }

      addLog({
        type: response.ok ? 'success' : 'error',
        message: response.ok ? `${endpoint}: Request successful` : `${endpoint}: ${response.statusText}`,
        endpoint,
        rawResponse: responseText,
      })

      if (!response.ok) {
        const errorData = data as { error?: string }
        throw new Error(errorData.error || response.statusText)
      }

      setConnectionStatus('connected')
      setLastConnectionError(null)

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isConnectivityError =
        errorMessage.includes('Failed to connect') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('ECONN') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Server responded with 500')

      if (isConnectivityError) {
        setConnectionStatus('disconnected')
        setLastConnectionError(errorMessage)
      }

      addLog({
        type: 'error',
        message: `${endpoint}: ${errorMessage}`,
        endpoint,
      })
      throw error
    } finally {
      setIsLoading(prev => ({ ...prev, [endpoint]: false }))
    }
  }, [config, addLog])

  // ONE combined snapshot per tick (owner order 2026-07-14): /api/server-snapshot
  // returns metrics + players (+ the server-side 1h FPS ring for admin tier) in
  // a single request. The panel never polls those endpoints separately.
  const fetchSnapshot = useCallback(async () => {
    if (!config) {
      return
    }

    setConnectionStatus((current) => (current === 'disconnected' ? 'checking' : current))
    setIsLoading(prev => ({ ...prev, snapshot: true }))

    try {
      const headers = new Headers(buildPalworldProxyHeaders(config))
      headers.set('Accept', 'application/json')

      const response = await fetch('/api/server-snapshot', { headers, cache: 'no-store' })
      const responseText = await response.text()

      let payload: SnapshotPayload = {}
      try {
        payload = JSON.parse(responseText) as SnapshotPayload
      } catch {
        payload = {}
      }

      if (!response.ok) {
        throw new Error(payload.error || response.statusText)
      }

      if (payload.metrics) {
        setServerMetrics(payload.metrics)
      }
      if (payload.players !== undefined) {
        setPlayers(payload.players as Player[]) // setPlayers normalizes any payload shape
      }
      if (payload.fpsHistory && Array.isArray(payload.fpsHistory.samples)) {
        const windowMs = resolveFpsWindowMs(payload.fpsHistory.windowMs)
        setFpsWindowMs(windowMs)
        setFpsHistoryState(trimFpsHistory(payload.fpsHistory.samples, windowMs))
      }

      addLog({
        type: 'success',
        message: 'server-snapshot: Request successful',
        endpoint: 'server-snapshot',
        rawResponse: JSON.stringify({
          serverfps: payload.metrics?.serverfps ?? null,
          players: normalizePlayersPayload(payload.players).length,
          historySamples: payload.fpsHistory?.samples?.length ?? 0,
        }),
      })

      setConnectionStatus('connected')
      setLastConnectionError(null)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const isConnectivityError =
        errorMessage.includes('Failed to connect') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('ECONN') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('unreachable')

      if (isConnectivityError) {
        setConnectionStatus('disconnected')
        setLastConnectionError(errorMessage)
      }

      addLog({
        type: 'error',
        message: `server-snapshot: ${errorMessage}`,
        endpoint: 'server-snapshot',
      })

      console.warn('Failed to fetch server snapshot:', error)
    } finally {
      setIsLoading(prev => ({ ...prev, snapshot: false }))
    }
  }, [config, addLog, setServerMetrics, setPlayers])

  const fetchAllData = useCallback(async () => {
    if (!config) {
      return
    }

    // Metrics + players + fps history ride the combined snapshot.
    void fetchSnapshot()

    // MOD tier never requests settings — the proxy allowlist would 403 it.
    const isModTier = config.accessTier === 'mod'
    const settingsPromise: Promise<Record<string, unknown> | null> = isModTier
      ? Promise.resolve(null)
      : apiCall<Record<string, unknown>>('settings')

    const results = await Promise.allSettled([
      apiCall<ServerInfo>('info'),
      settingsPromise,
    ])

    const [infoResult, settingsResult] = results

    if (infoResult.status === 'fulfilled') {
      setServerInfo(infoResult.value)
    } else {
      console.warn('Failed to fetch server info:', infoResult.reason)
    }

    if (isModTier) {
      // No settings state for the mod widget.
    } else if (settingsResult.status === 'fulfilled') {
      setSettings(settingsResult.value)
    } else {
      console.warn('Failed to fetch settings:', settingsResult.reason)
    }
  }, [config, apiCall, fetchSnapshot, setServerInfo, setSettings])

  useEffect(() => {
    if (config && isHydrated) {
      void fetchAllData()
    }
  }, [config, fetchAllData, isHydrated])

  useEffect(() => {
    if (!config || !isHydrated) {
      setNextSnapshotFetchAt(null)
      return
    }

    const scheduleNextSnapshotFetch = () => {
      setNextSnapshotFetchAt(Date.now() + SNAPSHOT_POLL_INTERVAL_MS)
    }

    scheduleNextSnapshotFetch()

    const interval = window.setInterval(() => {
      scheduleNextSnapshotFetch()
      void fetchSnapshot()
    }, SNAPSHOT_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
      setNextSnapshotFetchAt(null)
    }
  }, [config, fetchSnapshot, isHydrated])

  const value = useMemo<ServerContextType>(() => ({
    config,
    setConfig,
    clearConfig,
    isConfigured: !!config,
    players,
    setPlayers,
    consoleLogs,
    addLog,
    clearLogs,
    apiCall,
    isLoading,
    serverInfo,
    setServerInfo,
    serverMetrics,
    setServerMetrics,
    fpsHistory,
    fpsWindowMs,
    settings,
    setSettings,
    fetchAllData,
    fetchSnapshot,
    bannedPlayers,
    addBannedPlayer,
    removeBannedPlayer,
    connectionStatus,
    lastConnectionError,
    nextSnapshotFetchAt,
    snapshotPollIntervalMs: SNAPSHOT_POLL_INTERVAL_MS,
  }), [
    config,
    setConfig,
    clearConfig,
    players,
    setPlayers,
    consoleLogs,
    addLog,
    clearLogs,
    apiCall,
    isLoading,
    serverInfo,
    setServerInfo,
    serverMetrics,
    setServerMetrics,
    fpsHistory,
    fpsWindowMs,
    settings,
    setSettings,
    fetchAllData,
    fetchSnapshot,
    bannedPlayers,
    addBannedPlayer,
    removeBannedPlayer,
    connectionStatus,
    lastConnectionError,
    nextSnapshotFetchAt,
  ])

  if (!isHydrated) {
    return null
  }

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>
}
