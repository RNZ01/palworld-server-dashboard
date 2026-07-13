'use client'

import { useCallback, useEffect, useState } from 'react'
import { useServer } from '@/lib/server-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PlayerRoster } from '@/components/player-roster'
import { normalizePlayersPayload } from '@/lib/palworld'
import { cn } from '@/lib/utils'
import { LogOutIcon, SearchIcon } from 'lucide-react'

// Widget-local roster poll cadence. Deliberately calmer than the admin
// sidebar's default (10s) — this view targets phones over WAN.
const WIDGET_PLAYERS_POLL_INTERVAL_MS = 15_000

// Matches the dashboard header's connection dot palette.
const CONNECTION_DOT_CLASS: Record<'connected' | 'checking' | 'disconnected', string> = {
  connected: 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]',
  checking: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)] animate-pulse',
  disconnected: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)] animate-pulse',
}

// MOD-tier view: the personnel ledger and nothing else. No dashboard, map,
// tabs, announce, settings, management, or console. Hiding those here is
// cosmetic — the proxy's MOD_TIER_ALLOWLIST 403s every non-allowlisted
// endpoint server-side, so this widget could not reach them anyway.
export function ModWidget() {
  const { apiCall, setPlayers, serverInfo, connectionStatus, clearConfig } = useServer()
  const [search, setSearch] = useState('')

  const fetchPlayers = useCallback(async () => {
    try {
      const payload = await apiCall<unknown>('players')
      setPlayers(normalizePlayersPayload(payload))
    } catch {
      // Error already logged in apiCall
    }
  }, [apiCall, setPlayers])

  useEffect(() => {
    void fetchPlayers()
    const interval = setInterval(() => void fetchPlayers(), WIDGET_PLAYERS_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchPlayers])

  return (
    <div className="mx-auto flex h-dvh w-full max-w-xl flex-col gap-3 p-3">
      {/* Tiny header: connection dot + server name + tier badge + disconnect */}
      <header className="flex shrink-0 items-center gap-2.5 rounded border border-border/50 bg-card/50 px-3 py-2 backdrop-blur-sm">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', CONNECTION_DOT_CLASS[connectionStatus])} />
        <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold uppercase tracking-[0.14em] text-foreground">
          {serverInfo?.servername ?? 'Palworld Server'}
        </span>
        <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          Mod
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={clearConfig}
          aria-label="Disconnect"
        >
          <LogOutIcon className="h-4 w-4" />
        </Button>
      </header>

      {/* Personnel ledger */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-border/50 bg-card/50 p-3 backdrop-blur-sm">
        <div className="relative mb-3">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white" />
          <Input
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <PlayerRoster search={search} onAfterAction={() => void fetchPlayers()} variant="widget" />
      </div>
    </div>
  )
}
