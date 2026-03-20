'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { buildPalworldProxyHeaders, buildPalworldProxyPath, normalizePlayersPayload } from './palworld'
import type { ServerConfig, Player, ConsoleLog, ServerInfo, ServerMetrics, BannedPlayer, FpsSample } from './types'

type ConnectionStatus = 'disconnected' | 'checking' | 'connected'

const FPS_HISTORY_WINDOW_MS = 30 * 60 * 1000
const FPS_HISTORY_MAX_SAMPLES = 360
const METRICS_POLL_INTERVAL_MS = 60 * 1000
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
  }
}

function getServerIdentity(config: Pick<ServerConfig, 'serverIp' | 'restApiPort'>) {
  return `${config.serverIp.trim()}:${config.restApiPort.trim()}`
}

function getFpsHistoryStorageKey(config: Pick<ServerConfig, 'serverIp' | 'restApiPort'>) {
  return `${STORAGE_KEYS.fpsHistory}:${getServerIdentity(config)}`
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
  const [refreshRate, setRefreshRateState] = useState<number>(5)
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
    const storedHistory = storedConfig
      ? readStorageValue<FpsSample[]>(getFpsHistoryStorageKey(storedConfig), [])
      : readStorageValue<FpsSample[]>(LEGACY_FPS_HISTORY_STORAGE_KEY, [])
    const trimmedHistory = trimFpsHistory(storedHistory)

    setConfigState(shouldRestoreActiveSession ? storedConfig : null)
    setRefreshRateState(Number(localStorage.getItem(STORAGE_KEYS.refreshRate)) || 5)
    setPlayersState(normalizePlayersPayload(readStorageValue(STORAGE_KEYS.players, [])))
    setServerInfoState(readStorageValue<ServerInfo | null>(STORAGE_KEYS.serverInfo, null))
    setServerMetricsState(readStorageValue<ServerMetrics | null>(STORAGE_KEYS.serverMetrics, null))
    setFpsHistoryState(trimmedHistory)
    setSettingsState(readStorageValue<Record<string, unknown> | null>(STORAGE_KEYS.settings, null))
    setBannedPlayersState(readStorageValue<BannedPlayer[]>(STORAGE_KEYS.bannedPlayers, []))

    if (storedConfig) {
      writeStorageValue(getFpsHistoryStorageKey(storedConfig), trimmedHistory)
    }

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
    setFpsHistoryState(trimFpsHistory(readStorageValue<FpsSample[]>(getFpsHistoryStorageKey(normalizedConfig), [])))

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
    setRefreshRateState(5)
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
    setRefreshRateState(rate)
    localStorage.setItem(STORAGE_KEYS.refreshRate, rate.toString())
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
      setFpsHistoryState((previousHistory) => {
        const nextHistory = trimFpsHistory([
          ...previousHistory,
          {
            timestamp: Date.now(),
            fps: metrics.serverfps,
          },
        ])
        return nextHistory
      })
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

  const fetchAllData = useCallback(async () => {
    if (!config) {
      return
    }

    const results = await Promise.allSettled([
      apiCall<ServerInfo>('info'),
      apiCall<ServerMetrics>('metrics'),
      apiCall<Record<string, unknown>>('settings'),
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

    if (settingsResult.status === 'fulfilled') {
      setSettings(settingsResult.value)
    } else {
      console.warn('Failed to fetch settings:', settingsResult.reason)
    }
  }, [config, apiCall, setServerInfo, setServerMetrics, setSettings])

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
    }, METRICS_POLL_INTERVAL_MS)

    return () => {
      window.clearInterval(interval)
      setNextMetricsFetchAt(null)
    }
  }, [config, fetchMetrics, isHydrated])

  useEffect(() => {
    if (!config || !isHydrated) {
      return
    }

    writeStorageValue(getFpsHistoryStorageKey(config), trimFpsHistory(fpsHistory))
  }, [config, fpsHistory, isHydrated])

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
