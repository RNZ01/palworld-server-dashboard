'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { buildPalworldProxyHeaders } from '@/lib/palworld'
import { useServer } from '@/lib/server-context'
import type { WorldData, WorldParseStatus } from '@/lib/types'

const REFRESH_POLL_INTERVAL_MS = 2_000
const REFRESH_TIMEOUT_MS = 90_000

interface WorldApiPayload {
  available?: boolean
  world?: WorldData
  status?: WorldParseStatus | null
  stale?: boolean
  error?: string
}

interface WorldContextValue {
  world: WorldData | null
  status: WorldParseStatus | null
  available: boolean
  stale: boolean
  permissionDenied: boolean
  isRefreshing: boolean
  error: string | null
  refresh: () => Promise<void>
}

const WorldContext = createContext<WorldContextValue | null>(null)

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const handleAbort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    const timer = window.setTimeout(() => {
      signal.removeEventListener('abort', handleAbort)
      resolve()
    }, ms)
    signal.addEventListener('abort', handleAbort, { once: true })
  })
}

export function WorldProvider({ children }: { children: ReactNode }) {
  const { config, nextSnapshotFetchAt } = useServer()
  const [world, setWorld] = useState<WorldData | null>(null)
  const [status, setStatus] = useState<WorldParseStatus | null>(null)
  const [available, setAvailable] = useState(false)
  const [stale, setStale] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastSnapshotTickRef = useRef<number | null>(null)
  const refreshAbortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    setWorld(null)
    setStatus(null)
    setAvailable(false)
    setStale(false)
    setPermissionDenied(false)
    setIsRefreshing(false)
    setError(null)
  }, [])

  const requestWorld = useCallback(async (signal?: AbortSignal) => {
    if (!config) return null

    const response = await fetch('/api/world', {
      headers: {
        Accept: 'application/json',
        ...buildPalworldProxyHeaders(config),
      },
      cache: 'no-store',
      signal,
    })

    let payload: WorldApiPayload = {}
    try {
      payload = await response.json() as WorldApiPayload
    } catch {
      payload = {}
    }

    if (response.status === 401 || response.status === 403) {
      setWorld(null)
      setStatus(payload.status ?? null)
      setAvailable(false)
      setStale(false)
      setPermissionDenied(true)
      setError(null)
      return null
    }
    if (!response.ok) {
      throw new Error(payload.error || `World data request failed (${response.status})`)
    }

    const nextAvailable = payload.available === true && !!payload.world
    setWorld(nextAvailable ? payload.world! : null)
    setStatus(payload.status ?? null)
    setAvailable(nextAvailable)
    setStale(nextAvailable && payload.stale === true)
    setPermissionDenied(false)
    setError(null)
    return nextAvailable ? payload.world!.parsed_at : null
  }, [config])

  useEffect(() => {
    refreshAbortRef.current?.abort()
    lastSnapshotTickRef.current = null

    if (!config) {
      reset()
      return
    }
    if (config.accessTier === 'mod') {
      reset()
      setPermissionDenied(true)
      return
    }

    const controller = new AbortController()
    void requestWorld(controller.signal).catch((requestError: unknown) => {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return
      setError(requestError instanceof Error ? requestError.message : 'World data request failed')
    })
    return () => controller.abort()
  }, [config, requestWorld, reset])

  useEffect(() => {
    if (!config || config.accessTier === 'mod' || permissionDenied || nextSnapshotFetchAt === null) return
    if (lastSnapshotTickRef.current === null) {
      lastSnapshotTickRef.current = nextSnapshotFetchAt
      return
    }
    if (lastSnapshotTickRef.current === nextSnapshotFetchAt) return
    lastSnapshotTickRef.current = nextSnapshotFetchAt

    const controller = new AbortController()
    void requestWorld(controller.signal).catch((requestError: unknown) => {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return
      setError(requestError instanceof Error ? requestError.message : 'World data request failed')
    })
    return () => controller.abort()
  }, [config, nextSnapshotFetchAt, permissionDenied, requestWorld])

  useEffect(() => () => refreshAbortRef.current?.abort(), [])

  const refresh = useCallback(async () => {
    if (!config || permissionDenied || isRefreshing || refreshAbortRef.current) return

    const controller = new AbortController()
    refreshAbortRef.current = controller
    setIsRefreshing(true)
    setError(null)

    try {
      const previousParsedAt = world?.parsed_at ?? await requestWorld(controller.signal)
      const response = await fetch('/api/world/refresh', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...buildPalworldProxyHeaders(config),
        },
        cache: 'no-store',
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => ({})) as { error?: string }

      if (response.status === 401 || response.status === 403) {
        setPermissionDenied(true)
        setAvailable(false)
        throw new Error(payload.error || 'World data is admin-only')
      }
      if (!response.ok) {
        throw new Error(payload.error || `World refresh failed (${response.status})`)
      }

      const deadline = Date.now() + REFRESH_TIMEOUT_MS
      while (Date.now() < deadline) {
        await wait(REFRESH_POLL_INTERVAL_MS, controller.signal)
        const parsedAt = await requestWorld(controller.signal)
        if (parsedAt && parsedAt !== previousParsedAt) return
      }
      throw new Error('World refresh timed out after 90 seconds')
    } catch (refreshError) {
      if (refreshError instanceof DOMException && refreshError.name === 'AbortError') return
      const message = refreshError instanceof Error ? refreshError.message : 'World refresh failed'
      setError(message)
      throw refreshError
    } finally {
      if (refreshAbortRef.current === controller) refreshAbortRef.current = null
      setIsRefreshing(false)
    }
  }, [config, isRefreshing, permissionDenied, requestWorld, world?.parsed_at])

  const value = useMemo<WorldContextValue>(() => ({
    world,
    status,
    available,
    stale,
    permissionDenied,
    isRefreshing,
    error,
    refresh,
  }), [world, status, available, stale, permissionDenied, isRefreshing, error, refresh])

  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>
}

export function useWorld() {
  const context = useContext(WorldContext)
  if (!context) throw new Error('useWorld must be used within a WorldProvider')
  return context
}
