'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { buildPalworldProxyHeaders, buildPalworldProxyPath, normalizePlayersPayload } from './palworld'
import type { ServerConfig, Player, ConsoleLog, ServerInfo, ServerMetrics, BannedPlayer, FpsSample } from './types'

type ConnectionStatus = 'disconnected' | 'checking' | 'connected'

// FPS history is SERVER-SIDE (owner order 2026-07-13): palworld-fps-sampler.service
// maintains the authoritative 1h ring (5s cadence) in /run/palworld-metrics and the
// panel only fetches + displays it via /api/fps-history — the browser never collects.
// These constants sanitize the fetched payload and must match the sampler.
const FPS_HISTORY_WINDOW_MS = 1 * 60 * 60 * 1000
const FPS_HISTORY_MAX_SAMPLES = 720 // 1h at the sampler's 5s cadence
const METRICS_POLL_INTERVAL_MS = 5 * 1000 // live metrics poll; also drives the fps-history re-fetch

// Roster refresh-rate policy (owner 2026-07-13): REST polls cost PalServer game-thread time.
const REFRESH_RATE_DEFAULT_S = 10
const clampRefreshRate = (rate: number) => Math.min(Math.max(rate, 5), 60)
const LEGACY_FPS_HISTORY_STORAGE_KEY = 'fpsHistory'
const DEFAULT_GAME_PORT = '8211'
const ACTIVE_SESSION_STORAGE_KEY = 'activeServerSession'

const STORAGE_KEYS = {
  config: 'serverConfig',
  refreshRate: 'refreshRateOnlinePlayers',
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
  STORAGE_KEYS.refreshRate,
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

function trimFpsHistory(history: FpsSample[], now = Date.now()) {
  return history
    .filter((sample) => Number.isFinite(sample.timestamp) && Number.isFinite(sample.fps) && now - sample.timestamp <= FPS_HISTORY_WINDOW_MS)
    .slice(-FPS_HISTORY_MAX_SAMPLES)
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
  refreshRate: number
  setRefreshRate: (rate: number) => void
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
  settings: Record<string, unknown> | null
  setSettings: (settings: Record<string, unknown> | null) => void
  fetchAllData: () => Promise<void>
  bannedPlayers: BannedPlayer[]
  addBannedPlayer: (player: BannedPlayer) => void
  removeBannedPlayer: (steamId: string) => void
  connectionStatus: ConnectionStatus
  lastConnectionError: string | null
  nextMetricsFetchAt: number | null
  metricsPollIntervalMs: number
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
  const [refreshRate, setRefreshRateState] = useState<number>(REFRESH_RATE_DEFAULT_S)
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([])
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({})
  const [isHydrated, setIsHydrated] = useState(false)

  const [serverInfo, setServerInfoState] = useState<ServerInfo | null>(null)
  const [serverMetrics, setServerMetricsState] = useState<ServerMetrics | null>(null)
  const [fpsHistory, setFpsHistoryState] = useState<FpsSample[]>([])
  const [settings, setSettingsState] = useState<Record<string, unknown> | null>(null)
  const [bannedPlayers, setBannedPlayersState] = useState<BannedPlayer[]>([])
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [lastConnectionError, setLastConnectionError] = useState<string | null>(null)
  const [nextMetricsFetchAt, setNextMetricsFetchAt] = useState<number | null>(null)

  useEffect(() => {
    const storedConfig = normalizeServerConfig(readStorageValue<StoredServerConfig | null>(STORAGE_KEYS.config, null))
    const shouldRestoreActiveSession = isActiveSessionStored()

    // FPS history moved server-side — scrub stale client-collected history keys.
    Object.keys(localStorage)
      .filter((key) => key === LEGACY_FPS_HISTORY_STORAGE_KEY || key.startsWith(`${STORAGE_KEYS.fpsHistory}:`))
      .forEach((key) => localStorage.removeItem(key))

    setConfigState(shouldRestoreActiveSession ? storedConfig : null)
    const storedRefreshRate = clampRefreshRate(Number(localStorage.getItem(STORAGE_KEYS.refreshRate)) || REFRESH_RATE_DEFAULT_S) // seconds; stale minute-era values clamp to 60s
    setRefreshRateState(storedRefreshRate)
    localStorage.setItem(STORAGE_KEYS.refreshRate, storedRefreshRate.toString()) // write-back so storage can't keep a sub-floor value
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
    setRefreshRateState(REFRESH_RATE_DEFAULT_S) // review fix 2026-07-13: was 1 — bypassed the clamp and reinstated the rescinded 1s poll on disconnect->reconnect
    setConsoleLogs([])
    setIsLoading({})
    setConnectionStatus('disconnected')
    setLastConnectionError(null)
    setServerInfoState(null)
    setServerMetricsState(null)
    setFpsHistoryState([])
    setSettingsState(null)
    setBannedPlayersState([])
    setNextMetricsFetchAt(null)

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

  const setRefreshRate = useCallback((rate: number) => {
    const clamped = clampRefreshRate(rate)
    setRefreshRateState(clamped)
    localStorage.setItem(STORAGE_KEYS.refreshRate, clamped.toString())
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

  // Pulls the server-side 1h FPS ring (palworld-fps-sampler.service) via
  // /api/fps-history — the panel displays it verbatim and never collects its
  // own history. Admin tier only: the mod widget has no FPS graph.
  const fetchFpsHistory = useCallback(async () => {
    if (!config || config.accessTier !== 'admin') {
      return
    }

    try {
      const response = await fetch('/api/fps-history', {
        headers: buildPalworldProxyHeaders(config),
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error(`fps-history responded with ${response.status}`)
      }

      const payload = (await response.json()) as { samples?: FpsSample[] }
      setFpsHistoryState(trimFpsHistory(Array.isArray(payload.samples) ? payload.samples : []))
    } catch (error) {
      console.warn('Failed to fetch FPS history:', error)
    }
  }, [config])

  const fetchAllData = useCallback(async () => {
    if (!config) {
      return
    }

    void fetchFpsHistory()

    // MOD tier never requests settings — the proxy allowlist would 403 it.
    // info and metrics are mod-allowlisted (widget header + player count).
    const isModTier = config.accessTier === 'mod'
    const settingsPromise: Promise<Record<string, unknown> | null> = isModTier
      ? Promise.resolve(null)
      : apiCall<Record<string, unknown>>('settings')

    const results = await Promise.allSettled([
      apiCall<ServerInfo>('info'),
      apiCall<ServerMetrics>('metrics'),
      settingsPromise,
    ])

    const [infoResult, metricsResult, settingsResult] = results

    if (infoResult.status === 'fulfilled') {
      setServerInfo(infoResult.value)
    } else {
      console.warn('Failed to fetch server info:', infoResult.reason)
    }

    if (metricsResult.status === 'fulfilled') {
      setServerMetrics(metricsResult.value)
    } else {
      console.warn('Failed to fetch metrics:', metricsResult.reason)
    }

    if (isModTier) {
      // No settings state for the mod widget.
    } else if (settingsResult.status === 'fulfilled') {
      setSettings(settingsResult.value)
    } else {
      console.warn('Failed to fetch settings:', settingsResult.reason)
    }
  }, [config, apiCall, fetchFpsHistory, setServerInfo, setServerMetrics, setSettings])

  const fetchMetrics = useCallback(async () => {
    if (!config) {
      return
    }

    try {
      const metrics = await apiCall<ServerMetrics>('metrics')
      setServerMetrics(metrics)
    } catch (error) {
      console.warn('Failed to poll server metrics:', error)
    }
  }, [config, apiCall, setServerMetrics])

  useEffect(() => {
    if (config && isHydrated) {
      void fetchAllData()
    }
  }, [config, fetchAllData, isHydrated])

  useEffect(() => {
    if (!config || !isHydrated) {
      setNextMetricsFetchAt(null)
      return
    }

    const scheduleNextMetricsFetch = () => {
      setNextMetricsFetchAt(Date.now() + METRICS_POLL_INTERVAL_MS)
    }

    scheduleNextMetricsFetch()

    const interval = window.setInterval(() => {
      scheduleNextMetricsFetch()
      void fetchMetrics()
      void fetchFpsHistory()
    }, METRICS_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
      setNextMetricsFetchAt(null)
    }
  }, [config, fetchMetrics, fetchFpsHistory, isHydrated])

  const value = useMemo<ServerContextType>(() => ({
    config,
    setConfig,
    clearConfig,
    isConfigured: !!config,
    players,
    setPlayers,
    refreshRate,
    setRefreshRate,
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
    settings,
    setSettings,
    fetchAllData,
    bannedPlayers,
    addBannedPlayer,
    removeBannedPlayer,
    connectionStatus,
    lastConnectionError,
    nextMetricsFetchAt,
    metricsPollIntervalMs: METRICS_POLL_INTERVAL_MS,
  }), [
    config,
    setConfig,
    clearConfig,
    players,
    setPlayers,
    refreshRate,
    setRefreshRate,
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
    settings,
    setSettings,
    fetchAllData,
    bannedPlayers,
    addBannedPlayer,
    removeBannedPlayer,
    connectionStatus,
    lastConnectionError,
    nextMetricsFetchAt,
  ])

  if (!isHydrated) {
    return null
  }

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>
}
