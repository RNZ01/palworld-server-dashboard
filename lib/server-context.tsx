'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { buildPalworldApiUrl, normalizePlayersPayload } from './palworld'
import type { ServerConfig, Player, ConsoleLog, ServerInfo, ServerMetrics, BannedPlayer, FpsSample } from './types'

type ConnectionStatus = 'disconnected' | 'checking' | 'connected'

const FPS_HISTORY_WINDOW_MS = 60 * 60 * 1000
const FPS_HISTORY_MAX_SAMPLES = 360
const METRICS_POLL_INTERVAL_MS = 60 * 1000
const LEGACY_FPS_HISTORY_STORAGE_KEY = 'fpsHistory'

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

function getServerIdentity(config: Pick<ServerConfig, 'serverIp' | 'restApiPort'>) {
  return `${config.serverIp.trim()}:${config.restApiPort.trim()}`
}

function getFpsHistoryStorageKey(config: Pick<ServerConfig, 'serverIp' | 'restApiPort'>) {
  return `${STORAGE_KEYS.fpsHistory}:${getServerIdentity(config)}`
}

function trimFpsHistory(history: FpsSample[], now = Date.now()) {
  return history
    .filter((sample) => Number.isFinite(sample.timestamp) && Number.isFinite(sample.fps) && now - sample.timestamp <= FPS_HISTORY_WINDOW_MS)
    .slice(-FPS_HISTORY_MAX_SAMPLES)
}

interface ServerContextType {
  config: ServerConfig | null
  setConfig: (config: ServerConfig) => void
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
  // New properties for auto-fetch
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

  // Auto-fetch data state
  const [serverInfo, setServerInfoState] = useState<ServerInfo | null>(null)
  const [serverMetrics, setServerMetricsState] = useState<ServerMetrics | null>(null)
  const [fpsHistory, setFpsHistoryState] = useState<FpsSample[]>([])
  const [settings, setSettingsState] = useState<Record<string, unknown> | null>(null)
  const [bannedPlayers, setBannedPlayersState] = useState<BannedPlayer[]>([])
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [lastConnectionError, setLastConnectionError] = useState<string | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const storedConfig = readStorageValue<ServerConfig | null>(STORAGE_KEYS.config, null)
    const storedHistory = storedConfig
      ? readStorageValue<FpsSample[]>(getFpsHistoryStorageKey(storedConfig), [])
      : readStorageValue<FpsSample[]>(LEGACY_FPS_HISTORY_STORAGE_KEY, [])
    const trimmedHistory = trimFpsHistory(storedHistory)

    setConfigState(storedConfig)
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

  const setConfig = useCallback((newConfig: ServerConfig) => {
    setConfigState(newConfig)
    setConnectionStatus('checking')
    setLastConnectionError(null)
    setFpsHistoryState(trimFpsHistory(readStorageValue<FpsSample[]>(getFpsHistoryStorageKey(newConfig), [])))
    writeStorageValue(STORAGE_KEYS.config, newConfig)
    localStorage.setItem(STORAGE_KEYS.lastConnectedServer, `${newConfig.serverIp}:${newConfig.restApiPort}`)
  }, [])

  const clearConfig = useCallback(() => {
    setConfigState(null)
    setConnectionStatus('disconnected')
    setLastConnectionError(null)
    setFpsHistoryState([])
    localStorage.removeItem(STORAGE_KEYS.config)
    localStorage.removeItem(STORAGE_KEYS.lastConnectedServer)
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
      id: crypto.randomUUID(),
      timestamp: new Date(),
    }
    setConsoleLogs(prev => [newLog, ...prev].slice(0, 100)) // Keep last 100 logs
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

    const url = buildPalworldApiUrl(config, endpoint)

    try {
      const headers: HeadersInit = {
        'Accept': 'application/json',
      }

      if (body) {
        headers['Content-Type'] = 'application/json'
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

  // Fetch all data and store in localStorage
  // Note: ban, unban, announce, save, shutdown, stop are excluded from automatic fetching
  // as they are action endpoints, not data endpoints
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

  // Fetch all data on initial load only (no interval - OnlinePlayersPanel handles refresh)
  useEffect(() => {
    if (config && isHydrated) {
      void fetchAllData()
    }
  }, [config, fetchAllData, isHydrated])

  useEffect(() => {
    if (!config || !isHydrated) {
      return
    }

    const interval = window.setInterval(() => {
      void fetchMetrics()
    }, METRICS_POLL_INTERVAL_MS)

    return () => window.clearInterval(interval)
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
  ])

  if (!isHydrated) {
    return null
  }

  return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>
}
