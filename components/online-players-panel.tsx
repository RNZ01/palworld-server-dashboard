'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useServer } from '@/lib/server-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { PlayerRoster } from '@/components/player-roster'
import { getPlayerKey, normalizePlayersPayload } from '@/lib/palworld'
import { toast } from 'sonner'
import {
  RefreshCwIcon,
  SearchIcon,
  UserIcon,
  ClockIcon
} from 'lucide-react'
import type { Player } from '@/lib/types'

export function OnlinePlayersPanel() {
  const { apiCall, players, setPlayers, refreshRate, setRefreshRate, isLoading, fetchAllData } = useServer()
  const [search, setSearch] = useState('')
  const [countdown, setCountdown] = useState(refreshRate)
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
      setCountdown(refreshRateRef.current)
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
    const interval = setInterval(() => fetchPlayers(), refreshRate * 1000) // refreshRate is in seconds
    return () => clearInterval(interval)
  }, [fetchPlayers, refreshRate])

  // Countdown timer
  useEffect(() => {
    setCountdown(refreshRate)
    const countdownInterval = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : refreshRate))
    }, 1000)
    return () => clearInterval(countdownInterval)
  }, [refreshRate])

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleManualRefresh = () => {
    setCountdown(refreshRate)
    void fetchPlayers(true)
    void fetchAllData()
  }

  return (
    <aside className="flex h-full w-80 min-h-0">
      {/* Dechromed sidebar: InfoPanel container styling kept, no title/subtitle/icon rows —
          starts straight at the search + refresh controls. Row rendering + actions live in the shared
          PlayerRoster (also used by the mod-tier widget). */}
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded border border-border/50 bg-card/50 p-3 backdrop-blur-sm sm:p-4">
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
                <SelectItem value="5">5 sec</SelectItem>
                <SelectItem value="10">10 sec</SelectItem>
                <SelectItem value="15">15 sec</SelectItem>
                <SelectItem value="60">60 sec</SelectItem>
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

        <PlayerRoster search={search} onAfterAction={() => void fetchPlayers()} />
      </div>
    </aside>
  )
}
