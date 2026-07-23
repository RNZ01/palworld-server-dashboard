'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LayersIcon, MapIcon, RefreshCwIcon, TreePineIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { buildPalworldProxyHeaders, buildPalworldProxyPath, getPlayerKey, normalizePlayersPayload } from '@/lib/palworld'
import { useServer } from '@/lib/server-context'
import type { Player } from '@/lib/types'
import points from '@/lib/map-points.json'

// [maxX, maxY, minX, minY] — DT_WorldMapUIData landScapeRealPositionMax/Min tuple shape (pak v1.0).
// Each bounds tuple pairs ONLY with its matching pak-native image below.
type MapBounds = readonly [number, number, number, number]
const WORLD_LANDSCAPE: MapBounds = [349400, 724400, -1099400, -724400] // DT-exact: MainMap
const TREE_LANDSCAPE: MapBounds = [689148.5, -476400.0, 347351.5, -818197.0] // DT-exact: World Tree sub-map
const MAP_IMAGE_URL = '/palworld-map/full-map-native-8192.webp' // world
const MAP_IMAGE_FALLBACK_URL = '/palworld-map/full-map-z4.png' // Firefox-safe fallback
const MAP_IMAGE_TREE_URL = '/palworld-map/full-map-tree-8192.webp' // tree
const MIN_ZOOM = 0
const MAX_ZOOM = 10
const MAP_SIZE_FALLBACK = 920
const MAP_BASIS = 4096 // keep the transformed layer under common GPU texture limits; 8192+ zoom corrupts Chrome compositing
const REFRESH_INTERVAL_MS = 5000 // owner 2026-07-13: sane default (1s rescinded — REST /players is game-thread-synchronized on PalServer, ~1.2pp tick cost per req/s, A/B-measured)

interface PlayerMarkerGroup {
  id: string
  players: Array<{
    player: Player
    x: number
    y: number
  }>
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getFanoutOffset(index: number, count: number, scale: number) {
  if (count <= 1) {
    return { x: 0, y: 0 }
  }

  const radius = count <= 3 ? 22 : count <= 6 ? 30 : 38 // screen px: markers live in viewport space
  const angleOffset = count === 2 ? Math.PI / 2 : -Math.PI / 2
  const angle = angleOffset + (index / count) * Math.PI * 2

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }
}

function toMapPosition([worldX, worldY]: [number, number], bounds: MapBounds): [number, number] {
  const x = -256 + (256 * (worldX - bounds[2])) / (bounds[0] - bounds[2])
  const y = (256 * (worldY - bounds[3])) / (bounds[1] - bounds[3])

  return [x, y]
}

function fromMapPosition([mapX, mapY]: [number, number], bounds: MapBounds): [string, string] {
  const worldX = ((mapX + 256) * (bounds[0] - bounds[2])) / 256 + bounds[2]
  const worldY = (mapY * (bounds[1] - bounds[3])) / 256 + bounds[3]

  return [worldX.toFixed(2), worldY.toFixed(2)]
}

function toMapFraction(position: [number, number], bounds: MapBounds) {
  const [mapX, mapY] = toMapPosition(position, bounds)
  return { fx: mapY / 256, fy: -mapX / 256 }
}

function toScreenPercent(position: [number, number], bounds: MapBounds) {
  const [mapX, mapY] = toMapPosition(position, bounds)

  return {
    left: `${(mapY / 256) * 100}%`,
    top: `${(-mapX / 256) * 100}%`,
  }
}

function toScreenPixels(position: [number, number], width: number, height: number, bounds: MapBounds) {
  const [mapX, mapY] = toMapPosition(position, bounds)

  return {
    x: (mapY / 256) * width,
    y: (-mapX / 256) * height,
  }
}

type LiveMapView = 'dashboard' | 'map'

// External data source for the public read-only /view page: the parent owns the
// players and the refresh, so the map never builds panel-auth proxy requests.
export interface LiveMapSource {
  players: Player[]
  statusLabel: string
  onRefresh: () => Promise<void>
  refreshIntervalMs?: number
}

interface LiveMapProps {
  activeTab?: LiveMapView
  onTabChange?: (tab: LiveMapView) => void
  source?: LiveMapSource
}

export function LiveMap({ activeTab = 'map', onTabChange, source }: LiveMapProps) {
  let server: ReturnType<typeof useServer> | null = null
  try {
    server = useServer()
  } catch {
    server = null
  }

  if (!server && !source) {
    throw new Error('LiveMap must be used within a ServerProvider unless `source` is provided')
  }

  const config = server?.config ?? null
  const connectionStatus = server?.connectionStatus ?? 'disconnected'
  const contextPlayers = server?.players ?? []
  const setPlayers = server?.setPlayers ?? ((_nextPlayers: Player[]) => {})
  const players = source?.players ?? contextPlayers
  const statusLabel = source?.statusLabel ?? connectionStatus
  const refreshIntervalMs = source?.refreshIntervalMs ?? REFRESH_INTERVAL_MS
  const canRefresh = !!source || !!config
  // gmaps-style view: top-left-origin transform, cursor-anchored wheel zoom, edge-clamped pan (owner spec 2026-07-10)
  const [view, setView] = useState<{ scale: number; tx: number; ty: number } | null>(null)
  const [mousePosition, setMousePosition] = useState<[string, string]>(['0.00', '0.00'])
  // Layer toggles persist across reloads (owner order 2026-07-10)
  const readLayer = (key: string, fallback: boolean) => {
    if (typeof window === 'undefined') return fallback
    const v = localStorage.getItem(`mapLayer.${key}`)
    return v === null ? fallback : v === '1'
  }
  const persistLayer = (key: string, setter: (v: boolean) => void) => (v: boolean) => {
    setter(v)
    localStorage.setItem(`mapLayer.${key}`, v ? '1' : '0')
  }
  const [showPlayers, setShowPlayersRaw] = useState(() => readLayer('players', true))
  const [showBossTowers, setShowBossTowersRaw] = useState(() => readLayer('bossTowers', false))
  const [showFastTravels, setShowFastTravelsRaw] = useState(() => readLayer('fastTravels', false))
  const setShowPlayers = persistLayer('players', setShowPlayersRaw)
  const setShowBossTowers = persistLayer('bossTowers', setShowBossTowersRaw)
  const setShowFastTravels = persistLayer('fastTravels', setShowFastTravelsRaw)
  // Map canvas: main World (default) <-> World Tree sub-map. Persists like the layer toggles.
  const [mapMode, setMapModeRaw] = useState<'world' | 'tree'>(() => {
    if (typeof window === 'undefined') return 'world'
    return localStorage.getItem('mapMode') === 'tree' ? 'tree' : 'world'
  })
  // Active projection bounds + image swap follow the mode. World bounds === the pre-existing
  // LANDSCAPE, so world mode is byte-for-byte the old behavior.
  const activeBounds = mapMode === 'tree' ? TREE_LANDSCAPE : WORLD_LANDSCAPE
  const mapImageUrl = mapMode === 'tree' ? MAP_IMAGE_TREE_URL : MAP_IMAGE_URL
  const mapImageFallbackUrl = mapMode === 'world' ? MAP_IMAGE_FALLBACK_URL : null
  const [useMapImageFallback, setUseMapImageFallback] = useState(false)
  const mapImageSrc = useMapImageFallback && mapImageFallbackUrl ? mapImageFallbackUrl : mapImageUrl
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshCountdownMs, setRefreshCountdownMs] = useState(refreshIntervalMs)
  const [mapImageLoaded, setMapImageLoaded] = useState(false)
  const [mapImageError, setMapImageError] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isPageVisible, setIsPageVisible] = useState(true)
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null)
  const [mapSize, setMapSize] = useState({ width: MAP_SIZE_FALLBACK, height: MAP_SIZE_FALLBACK })
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const touchStateRef = useRef<
    | { mode: 'pan'; x: number; y: number; panX: number; panY: number }
    | { mode: 'pinch'; distance: number; midX: number; midY: number }
    | null
  >(null)
  const mapPlaneRef = useRef<HTMLDivElement | null>(null)
  const markerPlaneRef = useRef<HTMLDivElement | null>(null)
  const mapViewportRef = useRef<HTMLDivElement | null>(null)
  const nextAutoRefreshAtRef = useRef<number | null>(null)

  const fitScale = Math.min(mapSize.width, mapSize.height) / MAP_BASIS
  const scale = view?.scale ?? fitScale
  const zoomExact = Math.max(0, (scale / fitScale - 1) / 0.9)
  const zoom = Math.round(zoomExact * 2) / 2 // quantized: grouping/fanout recompute at half-steps, not per wheel tick
  const clampView = useCallback((v: { scale: number; tx: number; ty: number }, vw: number, vh: number) => {
    const w = MAP_BASIS * v.scale
    const h = MAP_BASIS * v.scale
    return {
      scale: v.scale,
      tx: w <= vw ? (vw - w) / 2 : clamp(v.tx, vw - w, 0),
      ty: h <= vh ? (vh - h) / 2 : clamp(v.ty, vh - h, 0),
    }
  }, [])

  // rAF-coalesce rapid view updates (wheel/drag): many events per frame -> one state commit.
  const pendingViewRef = useRef<{ scale: number; tx: number; ty: number } | null>(null)
  const rafRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const layoutViewRef = useRef<{ scale: number; tx: number; ty: number } | null>(null)
  const commitView = useCallback((v: { scale: number; tx: number; ty: number }) => {
    pendingViewRef.current = v
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const pv = pendingViewRef.current
        if (!pv) return
        // Gesture frames bypass React entirely: write the transform straight to both
        // layers on the compositor path ("make sure it's async" — owner 2026-07-10).
        const tf = `translate(${pv.tx}px, ${pv.ty}px) scale(${pv.scale})`
        if (mapPlaneRef.current) mapPlaneRef.current.style.transform = tf
        const v0 = layoutViewRef.current
        if (markerPlaneRef.current && v0) {
          const k = pv.scale / v0.scale
          markerPlaneRef.current.style.transform = `translate(${pv.tx - k * v0.tx}px, ${pv.ty - k * v0.ty}px) scale(${k})`
        }
      })
    }
    // Reconcile React state once the gesture rests (markers/grouping re-render then).
    if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null
      const pv = pendingViewRef.current
      if (!pv) return
      setView(pv)
      // Sync the imperative gesture transforms to the committed layout. Without this, a
      // React render that recomputes the SAME overlayTransform it already held (e.g. the
      // identity it had at gesture start) is skipped by React's DOM diff, leaving a stale
      // gesture transform on the marker plane -> markers drift until the next pan re-writes it.
      if (mapPlaneRef.current) mapPlaneRef.current.style.transform = `translate(${pv.tx}px, ${pv.ty}px) scale(${pv.scale})`
      if (markerPlaneRef.current) markerPlaneRef.current.style.transform = 'translate(0px, 0px) scale(1)'
    }, 150)
  }, [])

  // Track the view React last laid markers out with (gesture delta math needs it).
  useEffect(() => {
    layoutViewRef.current = view
  }, [view])

  // Screen-space marker math (owner spec: tags render at fixed rez in viewport space,
  // never scaled — only the map zooms). ov = at-rest layout view; overlayTransform =
  // transient gesture delta so tags track the map between React commits.
  const ov = view ?? {
    scale: fitScale,
    tx: (mapSize.width - MAP_BASIS * fitScale) / 2,
    ty: (mapSize.height - MAP_BASIS * fitScale) / 2,
  }
  const gvp = pendingViewRef.current ?? ov
  const ovK = gvp.scale / ov.scale
  const overlayTransform = `translate(${gvp.tx - ovK * ov.tx}px, ${gvp.ty - ovK * ov.ty}px) scale(${ovK})`


  // Initialize on first measure; re-clamp (and keep whole-map minimum) on viewport resize.
  useEffect(() => {
    setView((cur) => {
      const fit = Math.min(mapSize.width, mapSize.height) / MAP_BASIS
      if (!Number.isFinite(fit) || fit <= 0) return cur
      if (!cur) return clampView({ scale: fit, tx: 0, ty: 0 }, mapSize.width, mapSize.height)
      return clampView({ ...cur, scale: Math.max(cur.scale, fit) }, mapSize.width, mapSize.height)
    })
  }, [mapSize.width, mapSize.height, clampView])

  // Switch canvases and re-fit. Both maps are 8192², but a mode change resets the view so the
  // user lands at the fit view of the new canvas — reusing the same fit math as the init effect
  // above (clear any in-flight gesture first so the imperative path doesn't fight the reset).
  const switchMapMode = useCallback((mode: 'world' | 'tree') => {
    if (mode === mapMode) return
    setMapImageLoaded(false)
    setMapImageError(false)
    setUseMapImageFallback(false)
    setMapModeRaw(mode)
    if (typeof window !== 'undefined') localStorage.setItem('mapMode', mode)
    pendingViewRef.current = null
    const fit = Math.min(mapSize.width, mapSize.height) / MAP_BASIS
    setView(Number.isFinite(fit) && fit > 0 ? clampView({ scale: fit, tx: 0, ty: 0 }, mapSize.width, mapSize.height) : null)
  }, [mapMode, mapSize.width, mapSize.height, clampView])
  const mappablePlayers = useMemo(
    () => players.filter((player) => player.location_x !== 0 || player.location_y !== 0),
    [players]
  )

  const fastTravelMarkers = useMemo(
    () => points.fast_travel.map((point) => ({
      key: `fast-travel-${point[0]}-${point[1]}`,
      frac: toMapFraction([point[0], point[1]], activeBounds),
    })),
    [activeBounds]
  )

  const bossTowerMarkers = useMemo(
    () => points.boss_tower.map((point) => ({
      key: `boss-tower-${point[0]}-${point[1]}`,
      frac: toMapFraction([point[0], point[1]], activeBounds),
    })),
    [activeBounds]
  )

  const sourceRefresh = source?.onRefresh
  const refreshPlayers = useCallback(async () => {
    if (sourceRefresh) {
      await sourceRefresh()
      return
    }

    if (!config) {
      return
    }

    const response = await fetch(buildPalworldProxyPath('players'), {
      headers: {
        Accept: 'application/json',
        ...buildPalworldProxyHeaders(config),
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || 'players failed')
    }

    const payload = await response.json()
    setPlayers(normalizePlayersPayload(payload))
  }, [sourceRefresh, config, setPlayers])

  const refreshMap = useCallback(async () => {
    setIsRefreshing(true)

    try {
      await refreshPlayers()
    } finally {
      setIsRefreshing(false)
    }
  }, [refreshPlayers])

  useEffect(() => {
    const updateVisibility = () => setIsPageVisible(!document.hidden)

    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)

    return () => {
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  useEffect(() => {
    const element = mapViewportRef.current

    if (!element) {
      return
    }

    const updateSize = () => {
      setMapSize({
        width: element.clientWidth || MAP_SIZE_FALLBACK,
        height: element.clientHeight || MAP_SIZE_FALLBACK,
      })
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!canRefresh || !isPageVisible) {
      nextAutoRefreshAtRef.current = null
      setRefreshCountdownMs(refreshIntervalMs)
      return
    }

    const scheduleNextRefresh = () => {
      nextAutoRefreshAtRef.current = Date.now() + refreshIntervalMs
      setRefreshCountdownMs(refreshIntervalMs)
    }

    scheduleNextRefresh()
    void refreshMap()

    const interval = window.setInterval(() => {
      scheduleNextRefresh()
      void refreshMap()
    }, refreshIntervalMs)

    const countdownInterval = window.setInterval(() => {
      if (!nextAutoRefreshAtRef.current) {
        return
      }

      setRefreshCountdownMs(Math.max(0, nextAutoRefreshAtRef.current - Date.now()))
    }, 250)

    return () => {
      window.clearInterval(interval)
      window.clearInterval(countdownInterval)
    }
  }, [canRefresh, isPageVisible, refreshMap, refreshIntervalMs])

  useEffect(() => {
    if (!isDragging) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      const start = dragStartRef.current

      if (!start) {
        return
      }

      const rect = mapViewportRef.current?.getBoundingClientRect()
      const cur = pendingViewRef.current ?? view
      if (cur && rect) {
        commitView(
          clampView(
            {
              scale: cur.scale,
              tx: start.panX + (event.clientX - start.x),
              ty: start.panY + (event.clientY - start.y),
            },
            rect.width,
            rect.height,
          ),
        )
      }
    }

    const handleMouseUp = () => {
      dragStartRef.current = null
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, clampView, commitView, view])

  const handleMapMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const planeRect = mapPlaneRef.current?.getBoundingClientRect()

    if (!planeRect) {
      return
    }

    const leftRatio = clamp((event.clientX - planeRect.left) / planeRect.width, 0, 1)
    const topRatio = clamp((event.clientY - planeRect.top) / planeRect.height, 0, 1)
    const mapX = -topRatio * 256
    const mapY = leftRatio * 256

    const next = fromMapPosition([mapX, mapY], activeBounds)
    setMousePosition((cur) => (cur[0] === next[0] && cur[1] === next[1] ? cur : next))
  }, [activeBounds])

  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault()
    const rect = mapViewportRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = event.clientX - rect.left
    const cy = event.clientY - rect.top
    const fit = Math.min(rect.width, rect.height) / MAP_BASIS
    const base = pendingViewRef.current ?? view ?? { scale: fit, tx: (rect.width - MAP_BASIS * fit) / 2, ty: (rect.height - MAP_BASIS * fit) / 2 }
    const nextScale = clamp(base.scale * (event.deltaY < 0 ? 1.25 : 0.8), fit, 1.2)
    const k = nextScale / base.scale
    // anchor the point under the cursor: it must map to the same viewport position after scaling
    commitView(clampView({ scale: nextScale, tx: cx - (cx - base.tx) * k, ty: cy - (cy - base.ty) * k }, rect.width, rect.height))
  }, [clampView, commitView, view])

  useEffect(() => {
    const element = mapViewportRef.current
    if (!element) return

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  const getTouchDistance = (touches: TouchList) =>
    Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)

  const getTouchMidpoint = (touches: TouchList, rect: DOMRect) => ({
    x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
    y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
  })

  // (Re)initialize the active gesture from the current touch list — used on touchstart and
  // whenever the finger count changes mid-gesture (e.g. a second finger lands during a pan).
  const beginTouchGesture = useCallback((touches: TouchList, rect: DOMRect) => {
    const base = pendingViewRef.current ?? view

    if (touches.length === 1) {
      touchStateRef.current = {
        mode: 'pan',
        x: touches[0].clientX,
        y: touches[0].clientY,
        panX: base?.tx ?? 0,
        panY: base?.ty ?? 0,
      }
    } else if (touches.length >= 2) {
      const mid = getTouchMidpoint(touches, rect)
      touchStateRef.current = { mode: 'pinch', distance: getTouchDistance(touches), midX: mid.x, midY: mid.y }
    } else {
      touchStateRef.current = null
    }
  }, [view])

  const handleTouchStart = useCallback((event: TouchEvent) => {
    const rect = mapViewportRef.current?.getBoundingClientRect()
    if (!rect) return
    event.preventDefault()
    beginTouchGesture(event.touches, rect)
    setIsDragging(event.touches.length === 1)
  }, [beginTouchGesture])

  const handleTouchMove = useCallback((event: TouchEvent) => {
    const rect = mapViewportRef.current?.getBoundingClientRect()
    const state = touchStateRef.current
    if (!rect || !state) return
    event.preventDefault()

    if (state.mode === 'pan' && event.touches.length === 1) {
      const base = pendingViewRef.current ?? view
      if (!base) return
      const touch = event.touches[0]
      commitView(
        clampView(
          {
            scale: base.scale,
            tx: state.panX + (touch.clientX - state.x),
            ty: state.panY + (touch.clientY - state.y),
          },
          rect.width,
          rect.height,
        ),
      )
      return
    }

    if (state.mode === 'pinch' && event.touches.length >= 2) {
      const base = pendingViewRef.current ?? view
      if (!base) return
      const fit = Math.min(rect.width, rect.height) / MAP_BASIS
      const newDistance = getTouchDistance(event.touches)
      const newMid = getTouchMidpoint(event.touches, rect)
      const k = state.distance > 0 ? newDistance / state.distance : 1
      const nextScale = clamp(base.scale * k, fit, 1.2)
      const appliedK = nextScale / base.scale
      // anchor: the content point under the previous midpoint tracks to the new midpoint,
      // so pinch-zoom and the incidental two-finger pan it causes both fall out of one formula.
      const nextTx = newMid.x - appliedK * (state.midX - base.tx)
      const nextTy = newMid.y - appliedK * (state.midY - base.ty)
      commitView(clampView({ scale: nextScale, tx: nextTx, ty: nextTy }, rect.width, rect.height))
      touchStateRef.current = { mode: 'pinch', distance: newDistance, midX: newMid.x, midY: newMid.y }
      return
    }

    // Finger count changed mid-gesture — reinitialize instead of computing a bogus delta.
    beginTouchGesture(event.touches, rect)
  }, [beginTouchGesture, clampView, commitView, view])

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (event.touches.length === 0) {
      touchStateRef.current = null
      setIsDragging(false)
      return
    }

    const rect = mapViewportRef.current?.getBoundingClientRect()
    if (!rect) return
    beginTouchGesture(event.touches, rect)
    setIsDragging(event.touches.length === 1)
  }, [beginTouchGesture])

  useEffect(() => {
    const element = mapViewportRef.current
    if (!element) return

    element.addEventListener('touchstart', handleTouchStart, { passive: false })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: false })
    element.addEventListener('touchcancel', handleTouchEnd, { passive: false })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: view?.tx ?? 0,
      panY: view?.ty ?? 0,
    }
    setIsDragging(true)
  }, [view?.tx, view?.ty])

  const playerGroups = useMemo(() => {
    if (mappablePlayers.length === 0) {
      return [] as PlayerMarkerGroup[]
    }

    const shouldUngroup = zoom >= 6
    const groupScale = fitScale * (1 + zoom * 0.9) // from quantized zoom: stable across gesture frames
    const thresholdPx = shouldUngroup ? 0 : (38 * (1 - zoom / 6)) / groupScale
    const positionedPlayers = mappablePlayers.map((player) => ({
      player,
      ...toScreenPixels([player.location_x, player.location_y], MAP_BASIS, MAP_BASIS, activeBounds),
    }))
    const visited = new Set<number>()
    const groups: PlayerMarkerGroup[] = []

    for (let i = 0; i < positionedPlayers.length; i += 1) {
      if (visited.has(i)) {
        continue
      }

      const queue = [i]
      const memberIndexes: number[] = []
      visited.add(i)

      while (queue.length > 0) {
        const currentIndex = queue.shift()

        if (currentIndex === undefined) {
          continue
        }

        memberIndexes.push(currentIndex)
        const current = positionedPlayers[currentIndex]

        for (let j = 0; j < positionedPlayers.length; j += 1) {
          if (visited.has(j)) {
            continue
          }

          const candidate = positionedPlayers[j]
          const distance = Math.hypot(candidate.x - current.x, candidate.y - current.y)

          if (!shouldUngroup && distance <= thresholdPx) {
            visited.add(j)
            queue.push(j)
          }
        }
      }

      const members = memberIndexes.map((index) => positionedPlayers[index])

      groups.push({
        id: members.map((member) => getPlayerKey(member.player)).join('|'),
        players: members.map((member) => ({
          player: member.player,
          x: member.x,
          y: member.y,
        })),
      })
    }

    return groups
  }, [mappablePlayers, zoom, fitScale, activeBounds])

  const refreshLabel = useMemo(() => {
    if (!canRefresh) {
      return 'Refresh: --'
    }

    if (!isPageVisible) {
      return 'Refresh: Paused'
    }

    return `Refresh: ${Math.max(0, Math.ceil(refreshCountdownMs / 1000))}s`
  }, [canRefresh, isPageVisible, refreshCountdownMs])

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border/60 bg-card/70 px-4 py-3 backdrop-blur">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span>Live Map V4</span>
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="status-dot absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="status-dot relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Direct image renderer with live player markers from the `players` API.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onTabChange && (
            <Tabs
              value={activeTab}
              onValueChange={(value) => onTabChange(value === 'map' ? 'map' : 'dashboard')}
            >
              <TabsList className="h-10 rounded-md border border-border/60 bg-muted/20">
                <TabsTrigger value="dashboard" className="px-3 font-mono text-[11px] uppercase tracking-[0.2em] data-[state=active]:border-primary/60 data-[state=active]:bg-primary/10 data-[state=active]:text-primary sm:px-4">
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="map" className="px-3 font-mono text-[11px] uppercase tracking-[0.2em] data-[state=active]:border-primary/60 data-[state=active]:bg-primary/10 data-[state=active]:text-primary sm:px-4">
                  Live Map
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-10 gap-2 border-border/60 bg-muted/20 font-mono text-[11px] uppercase tracking-[0.2em]"
              >
                <LayersIcon className="h-3.5 w-3.5" />
                Layers
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              <DropdownMenuLabel>Map Layers</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={showFastTravels}
                onCheckedChange={setShowFastTravels}
                onSelect={(event) => event.preventDefault()}
                disabled={mapMode === 'tree'}
              >
                Fast Travel
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={showBossTowers}
                onCheckedChange={setShowBossTowers}
                onSelect={(event) => event.preventDefault()}
                disabled={mapMode === 'tree'}
              >
                Boss Towers
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={showPlayers}
                onCheckedChange={setShowPlayers}
                onSelect={(event) => event.preventDefault()}
              >
                Players
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tabs value={mapMode} onValueChange={(value) => switchMapMode(value === 'tree' ? 'tree' : 'world')}>
            <TabsList className="h-10 rounded-md border border-border/60 bg-muted/20">
              <TabsTrigger value="world" className="gap-1.5 px-3 font-mono text-[11px] uppercase tracking-[0.2em] data-[state=active]:border-primary/60 data-[state=active]:bg-primary/10 data-[state=active]:text-primary sm:px-4">
                <MapIcon className="h-3.5 w-3.5" />
                World
              </TabsTrigger>
              <TabsTrigger value="tree" className="gap-1.5 px-3 font-mono text-[11px] uppercase tracking-[0.2em] data-[state=active]:border-primary/60 data-[state=active]:bg-primary/10 data-[state=active]:text-primary sm:px-4">
                <TreePineIcon className="h-3.5 w-3.5" />
                Tree
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex h-10 items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Cursor</span>
            <span className="inline-block w-[24ch] text-right font-mono text-xs tabular-nums text-foreground">
              {mousePosition[0]}, {mousePosition[1]}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="border border-border/60 bg-muted/40 text-foreground hover:bg-muted/50">
            {statusLabel}
          </Badge>
          <Badge variant="secondary" className="border border-border/60 bg-muted/40 text-foreground hover:bg-muted/50">
            Players: {players.length}
          </Badge>
          <Button
            size="icon"
            variant="outline"
            className="border-border/70 bg-background/40 text-foreground hover:bg-muted/60 hover:text-foreground"
            onClick={() => void refreshMap()}
            disabled={isRefreshing || !canRefresh}
          >
            <RefreshCwIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div
        ref={mapViewportRef}
        className={`relative min-h-0 w-full flex-1 overflow-hidden bg-background/40 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ overscrollBehavior: 'contain', touchAction: 'none' }}
        onMouseMove={handleMapMouseMove}
        onMouseDown={handleMouseDown}
      >
        <div
          ref={mapPlaneRef}
          className="absolute left-0 top-0 will-change-transform"
          style={{
            width: `${MAP_BASIS}px`,
            height: `${MAP_BASIS}px`,
            transform: `translate(${(pendingViewRef.current ?? view)?.tx ?? 0}px, ${(pendingViewRef.current ?? view)?.ty ?? 0}px) scale(${(pendingViewRef.current ?? view)?.scale ?? scale})`,
            transformOrigin: '0 0',
          }}
        >
          <img
            src={mapImageSrc}
            alt={mapMode === 'tree' ? 'Palworld World Tree map' : 'Palworld world map'}
            className="block h-full w-full select-none object-cover"
            draggable={false}
            onLoad={() => {
              setMapImageLoaded(true)
              setMapImageError(false)
            }}
            onError={() => {
              setMapImageLoaded(false)
              if (mapImageFallbackUrl && !useMapImageFallback) {
                setUseMapImageFallback(true)
                return
              }
              setMapImageError(true)
            }}
          />

          <div className="pointer-events-none absolute left-3 top-3 z-30 rounded-full border border-primary/45 bg-primary/15 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-primary">
            MAP V4
          </div>
        </div>

        {/* Marker overlay: parallel layer with identical transform — keeps the image
            layer's raster UNTOUCHED by periodic marker updates and zoom counter-scaling
            (owner-diagnosed repaint storm, 2026-07-10) */}
        <div
          ref={markerPlaneRef}
          className="pointer-events-none absolute inset-0 will-change-transform"
          style={{
            transform: overlayTransform,
            transformOrigin: '0 0',
          }}
        >
          {showFastTravels && mapMode === 'world' &&
            fastTravelMarkers.map((point) => (
              <img
                key={point.key}
                src="/palworld-map/fast_travel.webp"
                alt=""
                className="absolute z-20 h-[42px] w-[42px] -translate-x-1/2 -translate-y-1/2 select-none object-contain"
                style={{
                  left: `${ov.tx + point.frac.fx * MAP_BASIS * ov.scale}px`,
                  top: `${ov.ty + point.frac.fy * MAP_BASIS * ov.scale}px`,
                }}
                draggable={false}
              />
            ))}

          {showBossTowers && mapMode === 'world' &&
            bossTowerMarkers.map((point) => (
              <img
                key={point.key}
                src="/palworld-map/boss_tower.webp"
                alt=""
                className="absolute z-20 h-[42px] w-[42px] -translate-x-1/2 -translate-y-1/2 select-none object-contain"
                style={{
                  left: `${ov.tx + point.frac.fx * MAP_BASIS * ov.scale}px`,
                  top: `${ov.ty + point.frac.fy * MAP_BASIS * ov.scale}px`,
                }}
                draggable={false}
              />
            ))}

          {showPlayers &&
            playerGroups.map((group) => {
              const isCluster = group.players.length > 1
              const isHovered = hoveredGroupId === group.id

              return (
                <div key={group.id}>
                  {group.players.map(({ player, x, y }, index) => {
                    const offset = getFanoutOffset(index, group.players.length, 1)

                    return (
                      <div
                        key={getPlayerKey(player)}
                        className={`pointer-events-auto absolute ${isHovered ? 'z-40' : 'z-30'}`}
                        style={{ left: `${ov.tx + x * ov.scale}px`, top: `${ov.ty + y * ov.scale}px` }}
                        onMouseEnter={() => setHoveredGroupId(group.id)}
                        onMouseLeave={() => setHoveredGroupId((current) => (current === group.id ? null : current))}
                      >
                        <div
                          className="pointer-events-none absolute left-0 top-0 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/45 bg-primary/35 shadow-lg shadow-primary/40"
                          style={{ transform: 'translate(-50%, -50%)' }}
                        />
                        <img
                          src="/palworld-map/player.webp"
                          alt=""
                          className="absolute left-0 top-0 h-[42px] w-[42px] -translate-x-1/2 -translate-y-1/2 select-none object-contain drop-shadow-[0_6px_14px_rgba(15,23,42,0.7)]"
                          style={{ transform: 'translate(-50%, -50%)' }}
                          draggable={false}
                        />
                        <div
                          className="absolute left-0 top-0"
                          style={{
                            transform: `translate(${offset.x}px, ${offset.y}px)`,
                            transformOrigin: 'center bottom',
                          }}
                        >
                          <div
                            className={`absolute left-0 top-0 whitespace-nowrap rounded-full border px-3 py-1 text-[15px] font-semibold shadow-xl transition-all ${
                              isCluster
                                ? isHovered
                                  ? 'border-primary/45 bg-card/95 text-foreground'
                                  : 'border-border/70 bg-card/90 text-foreground/90'
                                : 'border-primary/40 bg-card/92 text-foreground'
                            }`}
                            style={{
                              transform: 'translate(-50%, calc(-100% - 12px))',
                            }}
                          >
                            {player.name}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
        </div>

        {!mapImageLoaded && !mapImageError && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/65">
            <div className="rounded-full border border-border/70 bg-card/85 px-4 py-2 text-sm font-medium text-foreground shadow-xl backdrop-blur">
              Loading map image...
            </div>
          </div>
        )}

        {mapImageError && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/75 p-6">
            <div className="max-w-md rounded-2xl border border-destructive/35 bg-card/90 p-5 text-center text-foreground shadow-2xl">
              <div className="text-lg font-semibold">Map image failed to load</div>
              <p className="mt-2 text-sm text-muted-foreground">
                The app could not load <code className="font-mono text-destructive">{mapImageSrc}</code>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
