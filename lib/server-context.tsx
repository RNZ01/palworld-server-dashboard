'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { ServerConfig, Player, ConsoleLog, ServerInfo, ServerMetrics, BannedPlayer } from './types'

type ConnectionStatus = 'disconnected' | 'checking' | 'connected'

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
  const [settings, setSettingsState] = useState<Record<string, unknown> | null>(null)
  const [bannedPlayers, setBannedPlayersState] = useState<BannedPlayer[]>([])
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [lastConnectionError, setLastConnectionError] = useState<string | null>(null)

  // Load from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('serverConfig')
    const savedRefreshRate = localStorage.getItem('refreshRateOnlinePlayers')
    const savedPlayers = localStorage.getItem('onlinePlayers')
    const savedServerInfo = localStorage.getItem('serverInfo')
    const savedServerMetrics = localStorage.getItem('serverMetrics')
    const savedSettings = localStorage.getItem('settings')
    const savedBannedPlayers = localStorage.getItem('bannedPlayers')

    if (savedConfig) {
      setConfigState(JSON.parse(savedConfig))
    }
    if (savedRefreshRate) {
      setRefreshRateState(parseInt(savedRefreshRate, 10))
    }
    if (savedPlayers) {
      setPlayersState(JSON.parse(savedPlayers))
    }
    if (savedServerInfo) {
      setServerInfoState(JSON.parse(savedServerInfo))
    }
    if (savedServerMetrics) {
      setServerMetricsState(JSON.parse(savedServerMetrics))
    }
    if (savedSettings) {
      setSettingsState(JSON.parse(savedSettings))
    }
    if (savedBannedPlayers) {
      setBannedPlayersState(JSON.parse(savedBannedPlayers))
    }
    setIsHydrated(true)
  }, [])

  const setConfig = useCallback((newConfig: ServerConfig) => {
    setConfigState(newConfig)
    setConnectionStatus('checking')
    setLastConnectionError(null)
    localStorage.setItem('serverConfig', JSON.stringify(newConfig))
    localStorage.setItem('lastConnectedServer', `${newConfig.serverIp}:${newConfig.restApiPort}`)
  }, [])

  const clearConfig = useCallback(() => {
    setConfigState(null)
    setConnectionStatus('disconnected')
    setLastConnectionError(null)
    localStorage.removeItem('serverConfig')
    localStorage.removeItem('lastConnectedServer')
  }, [])

  const setPlayers = useCallback((newPlayers: Player[]) => {
    setPlayersState(newPlayers)
    localStorage.setItem('onlinePlayers', JSON.stringify(newPlayers))
  }, [])

  const setRefreshRate = useCallback((rate: number) => {
    setRefreshRateState(rate)
    localStorage.setItem('refreshRateOnlinePlayers', rate.toString())
  }, [])

  const setServerInfo = useCallback((info: ServerInfo | null) => {
    setServerInfoState(info)
    if (info) {
      localStorage.setItem('serverInfo', JSON.stringify(info))
    } else {
      localStorage.removeItem('serverInfo')
    }
  }, [])

  const setServerMetrics = useCallback((metrics: ServerMetrics | null) => {
    setServerMetricsState(metrics)
    if (metrics) {
      localStorage.setItem('serverMetrics', JSON.stringify(metrics))
    } else {
      localStorage.removeItem('serverMetrics')
    }
  }, [])

  const setSettings = useCallback((settings: Record<string, unknown> | null) => {
    setSettingsState(settings)
    if (settings) {
      localStorage.setItem('settings', JSON.stringify(settings))
    } else {
      localStorage.removeItem('settings')
    }
  }, [])

  const addBannedPlayer = useCallback((player: BannedPlayer) => {
    setBannedPlayersState(prev => {
      const updated = [player, ...prev.filter(p => p.steamId !== player.steamId)]
      localStorage.setItem('bannedPlayers', JSON.stringify(updated))
      return updated
    })
  }, [])

  const removeBannedPlayer = useCallback((steamId: string) => {
    setBannedPlayersState(prev => {
      const updated = prev.filter(p => p.steamId !== steamId)
      localStorage.setItem('bannedPlayers', JSON.stringify(updated))
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

    if (connectionStatus === 'disconnected') {
      setConnectionStatus('checking')
    }

    setIsLoading(prev => ({ ...prev, [endpoint]: true }))

    // Use the proxy API route to avoid mixed content issues
    const proxyParams = new URLSearchParams({
      serverIp: config.serverIp,
      serverPort: config.restApiPort,
      adminPassword: config.adminPassword,
    })
    const url = `/api/palworld/${endpoint}?${proxyParams.toString()}`

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
  }, [config, addLog, connectionStatus])

  // Fetch all data and store in localStorage
  // Note: ban, unban, announce, save, shutdown, stop are excluded from automatic fetching
  // as they are action endpoints, not data endpoints
  const fetchAllData = useCallback(async () => {
    if (!config) return

    try {
      // Fetch server info
      try {
        const info = await apiCall<ServerInfo>('info')
        setServerInfo(info)
      } catch (infoError) {
        console.warn('Failed to fetch server info:', infoError)
      }

      // Fetch metrics
      try {
        const metrics = await apiCall<ServerMetrics>('metrics')
        setServerMetrics(metrics)
      } catch (metricsError) {
        console.warn('Failed to fetch metrics:', metricsError)
      }

      // Fetch settings
      try {
        const settingsData = await apiCall<Record<string, unknown>>('settings')
        setSettings(settingsData)
      } catch (settingsError) {
        console.warn('Failed to fetch settings:', settingsError)
      }
    } catch (error) {
      console.error('Error in fetchAllData:', error)
    }
  }, [config, apiCall, setServerInfo, setServerMetrics, setSettings])

  // Fetch all data on initial load only (no interval - OnlinePlayersPanel handles refresh)
  useEffect(() => {
    if (config && isHydrated) {
      // Fetch data immediately on mount (only once)
      fetchAllData()
    }
    // Only run on initial config load, not on every refresh rate change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, isHydrated])

  if (!isHydrated) {
    return null
  }

  return (
    <ServerContext.Provider
      value={{
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
        // Auto-fetch properties
        serverInfo,
        setServerInfo,
        serverMetrics,
        setServerMetrics,
        settings,
        setSettings,
        fetchAllData,
        bannedPlayers,
        addBannedPlayer,
        removeBannedPlayer,
        connectionStatus,
        lastConnectionError,
      }}
    >
      {children}
    </ServerContext.Provider>
  )
}
