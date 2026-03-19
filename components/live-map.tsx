'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MinusIcon, PlusIcon, RefreshCwIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { buildPalworldApiUrl, getPlayerKey, normalizePlayersPayload } from '@/lib/palworld'
import { useServer } from '@/lib/server-context'
import type { Player } from '@/lib/types'
import points from '@/lib/map-points.json'

const LANDSCAPE = [447900, 708920, -999940, -738920] as const
const MAP_IMAGE_URL = '/palworld-map/full-map-z4.png'
const MIN_ZOOM = 0
const MAX_ZOOM = 10
const MAP_SIZE_FALLBACK = 920
const REFRESH_INTERVAL_MS = 5_000

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

  const radius = (count <= 3 ? 22 : count <= 6 ? 30 : 38) / scale
  const angleOffset = count === 2 ? Math.PI / 2 : -Math.PI / 2
  const angle = angleOffset + (index / count) * Math.PI * 2

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  }
}

function toMapPosition([worldX, worldY]: [number, number]): [number, number] {
  if (worldX >= -256 && worldX <= 256) {
    return [worldX, worldY]
  }

  const x = -256 + (256 * (worldX - LANDSCAPE[2])) / (LANDSCAPE[0] - LANDSCAPE[2])
  const y = (256 * (worldY - LANDSCAPE[3])) / (LANDSCAPE[1] - LANDSCAPE[3])

  return [x, y]
}

function fromMapPosition([mapX, mapY]: [number, number]): [string, string] {
  const worldX = ((mapX + 256) * (LANDSCAPE[0] - LANDSCAPE[2])) / 256 + LANDSCAPE[2]
  const worldY = (mapY * (LANDSCAPE[1] - LANDSCAPE[3])) / 256 + LANDSCAPE[3]

  return [worldX.toFixed(2), worldY.toFixed(2)]
}

function toScreenPercent(position: [number, number]) {
  const [mapX, mapY] = toMapPosition(position)

  return {
    left: `${(mapY / 256) * 100}%`,
    top: `${(-mapX / 256) * 100}%`,
  }
}

function toScreenPixels(position: [number, number], width: number, height: number) {
  const [mapX, mapY] = toMapPosition(position)

  return {
    x: (mapY / 256) * width,
    y: (-mapX / 256) * height,
  }
}

function ControlRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export function LiveMap() {
  const { config, connectionStatus, players, setPlayers } = useServer()
  const [zoom, setZoom] = useState(2)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [mousePosition, setMousePosition] = useState<[string, string]>(['0.00', '0.00'])
  const [showPlayers, setShowPlayers] = useState(true)
  const [showBossTowers, setShowBossTowers] = useState(false)
  const [showFastTravels, setShowFastTravels] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshCountdownMs, setRefreshCountdownMs] = useState(REFRESH_INTERVAL_MS)
  const [mapImageLoaded, setMapImageLoaded] = useState(false)
  const [mapImageError, setMapImageError] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isPageVisible, setIsPageVisible] = useState(true)
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null)
  const [mapSize, setMapSize] = useState({ width: MAP_SIZE_FALLBACK, height: MAP_SIZE_FALLBACK })
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)
  const mapPlaneRef = useRef<HTMLDivElement | null>(null)
  const nextAutoRefreshAtRef = useRef<number | null>(null)

  const scale = 1 + zoom * 0.45
  const mappablePlayers = useMemo(
    () => players.filter((player) => player.location_x !== 0 || player.location_y !== 0),
    [players]
  )

  const fastTravelMarkers = useMemo(
    () => points.fast_travel.map((point) => ({
      key: `fast-travel-${point[0]}-${point[1]}`,
      position: toScreenPercent([point[0], point[1]]),
    })),
    []
  )

  const bossTowerMarkers = useMemo(
    () => points.boss_tower.map((point) => ({
      key: `boss-tower-${point[0]}-${point[1]}`,
      position: toScreenPercent([point[0], point[1]]),
    })),
    []
  )

  const refreshPlayers = useCallback(async () => {
    if (!config) {
      return
    }

    const response = await fetch(buildPalworldApiUrl(config, 'players'), {
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || 'players failed')
    }

    const payload = await response.json()
    setPlayers(normalizePlayersPayload(payload))
  }, [config, setPlayers])

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
    const element = mapPlaneRef.current

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
    if (!config || !isPageVisible) {
      nextAutoRefreshAtRef.current = null
      setRefreshCountdownMs(REFRESH_INTERVAL_MS)
      return
    }

    const scheduleNextRefresh = () => {
      nextAutoRefreshAtRef.current = Date.now() + REFRESH_INTERVAL_MS
      setRefreshCountdownMs(REFRESH_INTERVAL_MS)
    }

    scheduleNextRefresh()
    void refreshMap()

    const interval = window.setInterval(() => {
      scheduleNextRefresh()
      void refreshMap()
    }, REFRESH_INTERVAL_MS)

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
  }, [config, isPageVisible, refreshMap])

  useEffect(() => {
    if (!isDragging) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      const start = dragStartRef.current

      if (!start) {
        return
      }

      setPan({
        x: start.panX + (event.clientX - start.x),
        y: start.panY + (event.clientY - start.y),
      })
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
  }, [isDragging])

  const handleMapMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const planeRect = mapPlaneRef.current?.getBoundingClientRect()

    if (!planeRect) {
      return
    }

    const leftRatio = clamp((event.clientX - planeRect.left) / planeRect.width, 0, 1)
    const topRatio = clamp((event.clientY - planeRect.top) / planeRect.height, 0, 1)
    const mapX = -topRatio * 256
    const mapY = leftRatio * 256

    setMousePosition(fromMapPosition([mapX, mapY]))
  }, [])

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()

    setZoom((current) => clamp(current + (event.deltaY < 0 ? 1 : -1), MIN_ZOOM, MAX_ZOOM))
  }, [])

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      panX: pan.x,
      panY: pan.y,
    }
    setIsDragging(true)
  }, [pan.x, pan.y])

  const playerGroups = useMemo(() => {
    if (mappablePlayers.length === 0) {
      return [] as PlayerMarkerGroup[]
    }

    const shouldUngroup = zoom >= 6
    const thresholdPx = shouldUngroup ? 0 : (38 * (1 - zoom / 6)) / scale
    const positionedPlayers = mappablePlayers.map((player) => ({
      player,
      ...toScreenPixels([player.location_x, player.location_y], mapSize.width, mapSize.height),
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
  }, [mapSize.height, mapSize.width, mappablePlayers, scale, zoom])

  const refreshLabel = useMemo(() => {
    if (!config) {
      return 'Refresh: --'
    }

    if (!isPageVisible) {
      return 'Refresh: Paused'
    }

    return `Refresh: ${Math.max(0, Math.ceil(refreshCountdownMs / 1000))}s`
  }, [config, isPageVisible, refreshCountdownMs])

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 bg-card/70 p-4 backdrop-blur">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span>Live Map V4</span>
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Direct image renderer with live player markers from the `players` API.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-primary/15 text-primary hover:bg-primary/15">
            {refreshLabel}
          </Badge>
          <Badge variant="secondary" className="border border-border/60 bg-muted/40 text-foreground hover:bg-muted/50">
            {connectionStatus}
          </Badge>
          <Badge variant="secondary" className="border border-border/60 bg-muted/40 text-foreground hover:bg-muted/50">
            Players: {players.length}
          </Badge>
          <Button
            size="icon"
            variant="outline"
            className="border-border/70 bg-background/40 text-foreground hover:bg-muted/60 hover:text-foreground"
            onClick={() => void refreshMap()}
            disabled={isRefreshing || !config}
          >
            <RefreshCwIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 p-4 xl:grid-cols-[18rem_1fr]">
        <Card className="border-border/60 bg-card/85 p-4 text-foreground shadow-2xl shadow-black/20 backdrop-blur xl:h-fit">
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/35 p-3">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Zoom</div>
              <div className="mt-1 text-2xl font-semibold">{zoom + 1}x</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {zoom >= 6 ? 'Players ungrouped' : 'Grouping relaxes as you zoom in'}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-border/60 bg-muted/35 p-4">
              <ControlRow label="Show fast travel" checked={showFastTravels} onCheckedChange={setShowFastTravels} />
              <ControlRow label="Show boss towers" checked={showBossTowers} onCheckedChange={setShowBossTowers} />
              <ControlRow label="Show players" checked={showPlayers} onCheckedChange={setShowPlayers} />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/35 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Cursor</span>
              <span className="font-mono text-foreground">
                {mousePosition[0]}, {mousePosition[1]}
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/45 px-3 py-4 shadow-xl">
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-foreground hover:bg-muted/60 hover:text-foreground"
                onClick={() => setZoom((current) => clamp(current + 1, MIN_ZOOM, MAX_ZOOM))}
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
              <div className="flex h-2 flex-1 items-center rounded-full bg-muted/45 p-[2px]">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${((zoom + 1) / (MAX_ZOOM + 1)) * 100}%` }}
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-foreground hover:bg-muted/60 hover:text-foreground"
                onClick={() => setZoom((current) => clamp(current - 1, MIN_ZOOM, MAX_ZOOM))}
              >
                <MinusIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        <div className="flex min-h-[60vh] items-center justify-center overflow-auto rounded-2xl border border-border/60 bg-card/40 p-4">
          <div
            className={`relative aspect-square overflow-hidden rounded-2xl border border-border/60 bg-background/40 shadow-2xl shadow-black/20 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{
              width: 'min(100%, 920px)',
              overscrollBehavior: 'contain',
            }}
            onMouseMove={handleMapMouseMove}
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
          >
            <div
              ref={mapPlaneRef}
              className="absolute left-1/2 top-1/2 h-full w-full will-change-transform"
              style={{
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: 'center center',
              }}
            >
              <img
                src={MAP_IMAGE_URL}
                alt="Palworld world map"
                className="block h-full w-full select-none object-cover"
                draggable={false}
                onLoad={() => {
                  setMapImageLoaded(true)
                  setMapImageError(false)
                }}
                onError={() => {
                  setMapImageLoaded(false)
                  setMapImageError(true)
                }}
              />

              <div className="pointer-events-none absolute left-3 top-3 z-30 rounded-full border border-primary/45 bg-primary/15 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-primary">
                MAP V4
              </div>

              {showFastTravels &&
                fastTravelMarkers.map((point) => (
                  <img
                    key={point.key}
                    src="/palworld-map/fast_travel.webp"
                    alt=""
                    className="absolute z-20 h-7 w-7 -translate-x-1/2 -translate-y-1/2 select-none object-contain"
                    style={point.position}
                    draggable={false}
                  />
                ))}

              {showBossTowers &&
                bossTowerMarkers.map((point) => (
                  <img
                    key={point.key}
                    src="/palworld-map/boss_tower.webp"
                    alt=""
                    className="absolute z-20 h-7 w-7 -translate-x-1/2 -translate-y-1/2 select-none object-contain"
                    style={point.position}
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
                        const offset = getFanoutOffset(index, group.players.length, scale)

                        return (
                          <div
                            key={getPlayerKey(player)}
                            className={`absolute ${isHovered ? 'z-40' : 'z-30'}`}
                            style={{ left: `${x}px`, top: `${y}px` }}
                            onMouseEnter={() => setHoveredGroupId(group.id)}
                            onMouseLeave={() => setHoveredGroupId((current) => (current === group.id ? null : current))}
                          >
                            <div
                              className="pointer-events-none absolute left-0 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/45 bg-primary/35 shadow-lg shadow-primary/40"
                              style={{ transform: `translate(-50%, -50%) scale(${1 / scale})` }}
                            />
                            <img
                              src="/palworld-map/player.webp"
                              alt=""
                              className="absolute left-0 top-0 h-7 w-7 -translate-x-1/2 -translate-y-1/2 select-none object-contain drop-shadow-[0_6px_14px_rgba(15,23,42,0.7)]"
                              style={{ transform: `translate(-50%, -50%) scale(${1 / scale})` }}
                              draggable={false}
                            />
                            <div
                              className="absolute left-0 top-0"
                              style={{
                                transform: `translate(${offset.x}px, ${offset.y}px) scale(${1 / scale})`,
                                transformOrigin: 'center bottom',
                              }}
                            >
                              <div
                                className={`absolute left-0 top-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold shadow-xl transition-all ${
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
                    The app could not load <code className="font-mono text-destructive">{MAP_IMAGE_URL}</code>.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
