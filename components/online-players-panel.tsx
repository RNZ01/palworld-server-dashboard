'use client'

import { useEffect, useState, useCallback } from 'react'
import { useServer } from '@/lib/server-context'
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
import { toast } from 'sonner'
import { 
  RefreshCwIcon, 
  SearchIcon, 
  MoreVerticalIcon, 
  UserIcon,
  BanIcon,
  UnlockIcon,
  UsersIcon
} from 'lucide-react'
import type { Player } from '@/lib/types'

interface PlayersResponse {
  players: Player[]
}

export function OnlinePlayersPanel() {
  const { apiCall, players, setPlayers, refreshRate, setRefreshRate, isLoading } = useServer()
  const [search, setSearch] = useState('')
  const [confirmAction, setConfirmAction] = useState<{ type: 'kick' | 'ban'; player: Player } | null>(null)

  const fetchPlayers = useCallback(async () => {
    try {
      const data = await apiCall<PlayersResponse>('players')
      if (data?.players) {
        setPlayers(data.players)
      }
    } catch {
      // Error already logged in apiCall
    }
  }, [apiCall, setPlayers])

  // Auto-refresh players
  useEffect(() => {
    fetchPlayers()
    const interval = setInterval(fetchPlayers, refreshRate * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchPlayers, refreshRate])

  const handleKick = async (player: Player) => {
    try {
      await apiCall('kick', 'POST', { userid: player.oddsId })
      toast.success(`Kicked ${player.name}`)
      fetchPlayers()
    } catch {
      toast.error(`Failed to kick ${player.name}`)
    }
    setConfirmAction(null)
  }

  const handleBan = async (player: Player) => {
    try {
      await apiCall('ban', 'POST', { userid: player.oddsId })
      toast.success(`Banned ${player.name}`)
      fetchPlayers()
    } catch {
      toast.error(`Failed to ban ${player.name}`)
    }
    setConfirmAction(null)
  }

  const handleUnban = async (player: Player) => {
    try {
      await apiCall('unban', 'POST', { userid: player.oddsId })
      toast.success(`Unbanned ${player.oddsId}`)
    } catch {
      toast.error(`Failed to unban ${player.oddsId}`)
    }
  }

  const filteredPlayers = players.filter(player =>
    player.name.toLowerCase().includes(search.toLowerCase()) ||
    player.oddsId?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <aside className="w-80 border-l border-border bg-card/30 flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground">Online Players</h2>
          </div>
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
            {players.length}
          </span>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-input border-border h-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Select value={refreshRate.toString()} onValueChange={(v) => setRefreshRate(parseInt(v, 10))}>
              <SelectTrigger className="flex-1 bg-input border-border h-9 text-sm">
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
              onClick={fetchPlayers}
              disabled={isLoading['players']}
              className="h-9 w-9 border-border"
            >
              {isLoading['players'] ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <RefreshCwIcon className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredPlayers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {search ? 'No players found' : 'No players online'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredPlayers.map((player) => (
                <div
                  key={player.oddsId || player.playerId}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <UserIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{player.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Lvl {player.level} | {player.ping}ms
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
                      <DropdownMenuItem onClick={() => setConfirmAction({ type: 'kick', player })}>
                        <UserIcon className="w-4 h-4 mr-2" />
                        Kick Player
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setConfirmAction({ type: 'ban', player })}
                        className="text-destructive focus:text-destructive"
                      >
                        <BanIcon className="w-4 h-4 mr-2" />
                        Ban Player
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleUnban(player)}>
                        <UnlockIcon className="w-4 h-4 mr-2" />
                        Unban Player
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

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
