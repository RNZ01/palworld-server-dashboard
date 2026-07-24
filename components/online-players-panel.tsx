'use client'

import { useEffect, useRef, useState } from 'react'
import { useServer } from '@/lib/server-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { PlayerRoster } from '@/components/player-roster'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getPlayerKey } from '@/lib/palworld'
import { toast } from 'sonner'
import {
  RefreshCwIcon,
  SearchIcon,
  UserIcon,
  ClockIcon,
  HistoryIcon,
  UserPlusIcon,
  UserMinusIcon,
} from 'lucide-react'
import type { Player } from '@/lib/types'

export function OnlinePlayersPanel() {
  // Roster data arrives via the FIXED 15s combined snapshot in server-context
  // (owner order 2026-07-14: one call for metrics+players, no configurable
  // poll rates) — this panel renders it and diffs updates for join/leave toasts.
  const {
    players,
    playerActivity,
    isLoading,
    fetchAllData,
    fetchSnapshot,
    nextSnapshotFetchAt,
    snapshotPollIntervalMs,
  } = useServer()
  const [view, setView] = useState<'online' | 'activity'>('online')
  const [search, setSearch] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null)
  const previousPlayersRef = useRef<Player[]>(players)

  // Join/leave toasts: diff every roster update against the previous one.
  useEffect(() => {
    const prevPlayers = previousPlayersRef.current
    if (prevPlayers === players) {
      return
    }

    if (prevPlayers.length > 0 || players.length > 0) {
      const prevIds = new Set(prevPlayers.map(getPlayerKey))
      const newIds = new Set(players.map(getPlayerKey))
      const joined = players.filter((player) => !prevIds.has(getPlayerKey(player)))
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

    previousPlayersRef.current = players
  }, [players])

  // Countdown to the next snapshot tick (display only — the cadence is fixed).
  useEffect(() => {
    const tick = () => {
      setCountdown(
        nextSnapshotFetchAt != null
          ? Math.max(0, Math.ceil((nextSnapshotFetchAt - Date.now()) / 1000))
          : null
      )
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [nextSnapshotFetchAt])

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleManualRefresh = () => {
    void fetchAllData()
  }

  return (
    <aside className="flex h-full w-80 min-h-0">
      {/* Dechromed sidebar (owner order): InfoPanel container styling kept, no title/subtitle/icon rows —
          starts straight at the search + refresh controls. Row rendering + actions live in the shared
          PlayerRoster (also used by the mod-tier widget). */}
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded border border-border/50 bg-card/50 p-3 backdrop-blur-sm sm:p-4">
        <div className="mb-3 grid grid-cols-2 gap-1 rounded-md bg-secondary/40 p-1">
          <Button
            variant={view === 'online' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView('online')}
            aria-pressed={view === 'online'}
          >
            <UserIcon className="w-4 h-4" />
            Online ({players.length})
          </Button>
          <Button
            variant={view === 'activity' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView('activity')}
            aria-pressed={view === 'activity'}
          >
            <HistoryIcon className="w-4 h-4" />
            Activity
          </Button>
        </div>

        {view === 'online' ? (
          <>
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

              {/* Fixed cadence indicator (owner 2026-07-14: rate selector removed) + manual refresh. */}
              <div className="flex items-center gap-2">
                <div className="flex h-9 flex-1 items-center justify-center gap-2 text-xs text-muted-foreground bg-secondary/50 rounded-md px-3">
                  <ClockIcon className="w-3 h-3" />
                  <span>
                    Auto {Math.floor(snapshotPollIntervalMs / 1000)}s · next in{' '}
                    <span className="font-mono font-medium text-foreground">
                      {countdown != null ? formatCountdown(countdown) : '–:––'}
                    </span>
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleManualRefresh}
                  disabled={isLoading['snapshot'] || isLoading['info'] || isLoading['settings']}
                  className="h-9 w-9 border-border"
                  aria-label="Refresh player roster"
                >
                  {isLoading['snapshot'] ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    <RefreshCwIcon className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <PlayerRoster search={search} onAfterAction={() => void fetchSnapshot()} />
          </>
        ) : (
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-1 p-2">
              {!playerActivity.available ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Player activity history is not enabled.
                </div>
              ) : playerActivity.events.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No player activity recorded yet.
                </div>
              ) : (
                [...playerActivity.events].reverse().map((event, index) => {
                  const joined = event.type === 'join'
                  return (
                    <div
                      key={`${event.timestamp}-${event.type}-${index}`}
                      className="flex items-center gap-3 rounded-lg p-2 hover:bg-secondary/50"
                    >
                      {joined ? (
                        <UserPlusIcon className="h-4 w-4 shrink-0 text-green-500" />
                      ) : (
                        <UserMinusIcon className="h-4 w-4 shrink-0 text-yellow-500" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{event.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {joined ? 'Joined' : 'Left'}
                        </p>
                      </div>
                      <time
                        dateTime={new Date(event.timestamp).toISOString()}
                        className="shrink-0 text-right text-[11px] text-muted-foreground"
                      >
                        {new Date(event.timestamp).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </aside>
  )
}
