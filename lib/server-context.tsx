'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { ServerConfig, Player, ConsoleLog } from './types'

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

  // Load from localStorage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('serverConfig')
    const savedRefreshRate = localStorage.getItem('refreshRateOnlinePlayers')
    const savedPlayers = localStorage.getItem('onlinePlayers')
    
    if (savedConfig) {
      setConfigState(JSON.parse(savedConfig))
    }
    if (savedRefreshRate) {
      setRefreshRateState(parseInt(savedRefreshRate, 10))
    }
    if (savedPlayers) {
      setPlayersState(JSON.parse(savedPlayers))
    }
    setIsHydrated(true)
  }, [])

  const setConfig = useCallback((newConfig: ServerConfig) => {
    setConfigState(newConfig)
    localStorage.setItem('serverConfig', JSON.stringify(newConfig))
    localStorage.setItem('lastConnectedServer', `${newConfig.serverIp}:${newConfig.restApiPort}`)
  }, [])

  const clearConfig = useCallback(() => {
    setConfigState(null)
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

    setIsLoading(prev => ({ ...prev, [endpoint]: true }))
    
    const baseUrl = `http://${config.serverIp}:${config.restApiPort}/v1/api`
    const url = `${baseUrl}/${endpoint}`
    
    try {
      const headers: HeadersInit = {
        'Accept': 'application/json',
        'Authorization': `Basic ${btoa(`admin:${config.adminPassword}`)}`,
      }
      
      if (body) {
        headers['Content-Type'] = 'application/json'
      }

      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })

      const data = await response.json() as T
      
      addLog({
        type: response.ok ? 'success' : 'error',
        message: response.ok ? `${endpoint}: Request successful` : `${endpoint}: ${response.statusText}`,
        endpoint,
      })

      if (!response.ok) {
        throw new Error(response.statusText)
      }

      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
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
      }}
    >
      {children}
    </ServerContext.Provider>
  )
}
