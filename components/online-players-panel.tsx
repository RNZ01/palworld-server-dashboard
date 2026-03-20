'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { InfoPanel } from '@/components/status-bar'
import { useServer } from '@/lib/server-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { getPlayerKey, normalizePlayersPayload } from '@/lib/palworld'
import { getPlayerAvatarColor } from '@/lib/player-avatar-colors'
import { toast } from 'sonner'
import {
  RefreshCwIcon,
  SearchIcon,
  MoreVerticalIcon,
  UserIcon,
  BanIcon,
  UnlockIcon,
  UsersIcon,
  ClockIcon,
  WifiIcon
} from 'lucide-react'
import type { Player } from '@/lib/types'

function getPingColor(ping: number) {
  if (ping < 80) return 'text-green-500'
  if (ping < 150) return 'text-yellow-500'
  return 'text-red-500'
}

function getPlayerInitial(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.charAt(0).toUpperCase()
}

export function OnlinePlayersPanel() {
  const { apiCall, players, setPlayers, refreshRate, setRefreshRate, isLoading, fetchAllData, addBannedPlayer, bannedPlayers, removeBannedPlayer } = useServer()
  const [search, setSearch] = useState('')
  const [confirmAction, setConfirmAction] = useState<{ type: 'kick' | 'ban'; player: Player } | null>(null)
  const [countdown, setCountdown] = useState(refreshRate * 60)
  const previousPlayersRef = useRef<Player[]>(players)
  const refreshRateRef = useRef(refreshRate)

  useEffect(() => { refreshRateRef.current = refreshRate }, [refreshRate])

  const fetchPlayers = useCallback(async (isManual = false) => {
    try {
      const payload = await apiCall<unknown>('players')
      const newPlayers = normalizePlayersPayload(payload)
      const prevPlayers = previousPlayersRef.current

      if (prevPlayers.length > 0 || newPlayers.length > 0) {
        const prevIds = new Set(prevPlayers.map(getPlayerKey))
        const newIds = new Set(newPlayers.map(getPlayerKey))
        const joined = newPlayers.filter((player) => !prevIds.has(getPlayerKey(player)))
        const left = prevPlayers.filter((player) => !newIds.has(getPlayerKey(player)))

        joined.forEach((player) => {
          toast.success(`${player.name} joined the server`, {
            icon: <UserIcon className="w-4 h-4 text-green-500" />,
          })
        })

        left.forEach((player) => {
          toast.info(`${player.name} left the server`, {
            icon: <UserIcon className="w-4 h-4 text-yellow-500" />,
          })
        })
      }

      previousPlayersRef.current = newPlayers
      setPlayers(newPlayers)
    } catch {
      // Error already logged in apiCall
    }

    if (!isManual) {
      setCountdown(refreshRateRef.current * 60)
    }
  }, [apiCall, setPlayers])

  // Initial fetch on mount only - use a ref to ensure single execution
  const hasInitializedRef = useRef(false)
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      fetchPlayers()
    }
  }, [fetchPlayers])

  // Restart interval when refreshRate changes (no immediate fetch)
  useEffect(() => {
    const interval = setInterval(() => fetchPlayers(), refreshRate * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchPlayers, refreshRate])

  // Countdown timer
  useEffect(() => {
    setCountdown(refreshRate * 60)
    const countdownInterval = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : refreshRate * 60))
    }, 1000)
    return () => clearInterval(countdownInterval)
  }, [refreshRate])

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleManualRefresh = () => {
    setCountdown(refreshRate * 60)
    void fetchPlayers(true)
    void fetchAllData()
  }

  const handleKick = async (player: Player) => {
    if (!player.userId) {
      toast.error(`Cannot kick ${player.name}: missing user ID`)
      setConfirmAction(null)
      return
    }

    try {
      await apiCall('kick', 'POST', { userid: player.userId })
      toast.success(`Kicked ${player.name}`)
      void fetchPlayers()
    } catch {
      toast.error(`Failed to kick ${player.name}`)
    }
    setConfirmAction(null)
  }

  const handleBan = async (player: Player) => {
    if (!player.userId) {
      toast.error(`Cannot ban ${player.name}: missing user ID`)
      setConfirmAction(null)
      return
    }

    try {
      await apiCall('ban', 'POST', { userid: player.userId })
      addBannedPlayer({ name: player.name, steamId: player.userId, bannedAt: new Date().toISOString() })
      toast.success(`Banned ${player.name}`)
      void fetchPlayers()
    } catch {
      toast.error(`Failed to ban ${player.name}`)
    }
    setConfirmAction(null)
  }

  const handleUnban = async (player: Player) => {
    if (!player.userId) {
      toast.error(`Cannot unban ${player.name}: missing user ID`)
      return
    }

    try {
      await apiCall('unban', 'POST', { userid: player.userId })
      removeBannedPlayer(player.userId)
      toast.success(`Unbanned ${player.name}`)
    } catch {
      toast.error(`Failed to unban ${player.name}`)
    }
  }

  const searchQuery = search.trim().toLowerCase()
  const bannedPlayerIds = useMemo(() => new Set(bannedPlayers.map((player) => player.steamId)), [bannedPlayers])

  const filteredPlayers = useMemo(() => {
    if (!searchQuery) {
      return players
    }

    return players.filter((player) =>
      player.name.toLowerCase().includes(searchQuery) ||
      player.userId.toLowerCase().includes(searchQuery)
    )
  }, [players, searchQuery])

  return (
    <aside className="flex h-full w-80 min-h-0">
      <InfoPanel title="Online Players" subtitle="Personnel Ledger" status="active" className="flex h-full min-h-0 w-full flex-col">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">Roster</h2>
          </div>
          <Badge variant="secondary" className="px-2 py-1">
            {players.length}
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white" />
            <Input
              placeholder="Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={refreshRate.toString()} onValueChange={(v) => setRefreshRate(parseInt(v, 10))}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 min</SelectItem>
                <SelectItem value="2">2 min</SelectItem>
                <SelectItem value="5">5 min</SelectItem>
                <SelectItem value="10">10 min</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={handleManualRefresh}
              disabled={isLoading['players'] || isLoading['info'] || isLoading['metrics'] || isLoading['settings']}
              className="h-9 w-9 border-border"
            >
              {isLoading['players'] ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <RefreshCwIcon className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Countdown Timer */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-md py-1.5 px-3">
            <ClockIcon className="w-3 h-3" />
            <span>Next refresh in <span className="font-mono font-medium text-foreground">{formatCountdown(countdown)}</span></span>
          </div>
        </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          {filteredPlayers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {search ? 'No players found' : 'No players online'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredPlayers.map((player) => {
                const isBanned = bannedPlayerIds.has(player.userId)
                const avatarColor = getPlayerAvatarColor(getPlayerKey(player))
                return (
                <div
                  key={getPlayerKey(player)}
                  className={`flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors group ${isBanned ? 'border border-destructive/30 bg-destructive/5' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`avatar-circle w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border border-white/20 ${isBanned ? 'ring-1 ring-destructive/60' : ''}`}
                      style={{ backgroundColor: avatarColor }}
                    >
                      <span className="font-mono text-sm font-semibold text-white">
                        {getPlayerInitial(player.name)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-foreground truncate">{player.name}</p>
                        {isBanned && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive shrink-0">BANNED</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        Lvl {player.level}
                        {player.accountName && player.accountName !== player.name && (
                          <><span className="mx-0.5">·</span><span className="truncate max-w-20">{player.accountName}</span></>
                        )}
                        <span className="mx-0.5">|</span>
                        <WifiIcon className={`w-3 h-3 ${getPingColor(Math.floor(player.ping ?? 0))}`} />
                        <span className={getPingColor(Math.floor(player.ping ?? 0))}>{Math.floor(player.ping ?? 0)}ms</span>
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVerticalIcon className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      {!isBanned && (
                        <DropdownMenuItem onClick={() => setConfirmAction({ type: 'kick', player })}>
                          <UserIcon className="w-4 h-4 mr-2" />
                          Kick Player
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {isBanned ? (
                        <DropdownMenuItem onClick={() => handleUnban(player)}>
                          <UnlockIcon className="w-4 h-4 mr-2" />
                          Unban Player
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => setConfirmAction({ type: 'ban', player })}
                          className="text-destructive focus:text-destructive"
                        >
                          <BanIcon className="w-4 h-4 mr-2" />
                          Ban Player
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>
      </InfoPanel>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'kick' ? 'Kick Player' : 'Ban Player'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmAction?.type} {confirmAction?.player.name}?
              {confirmAction?.type === 'ban' && ' This action can be reversed by unbanning the player.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction?.type === 'kick') {
                  handleKick(confirmAction.player)
                } else if (confirmAction?.type === 'ban') {
                  handleBan(confirmAction.player)
                }
              }}
              className={confirmAction?.type === 'ban' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {confirmAction?.type === 'kick' ? 'Kick' : 'Ban'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}
