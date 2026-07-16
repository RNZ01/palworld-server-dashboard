'use client'

import { AlertTriangleIcon, RefreshCwIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useWorld } from '@/lib/use-world'
import { formatWorldClock } from '@/lib/world-time'

interface WorldDataStatusProps {
  compact?: boolean
}

export function WorldDataStatus({ compact = false }: WorldDataStatusProps) {
  const { world, status, available, stale, permissionDenied, isRefreshing, error, refresh } = useWorld()

  if (permissionDenied) return null

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? 'text-[11px]' : 'text-xs'}`}>
      <span className="font-mono uppercase tracking-[0.14em] text-muted-foreground">
        {available && world ? `World as of ${formatWorldClock(world.parsed_at)}` : 'No world data yet'}
      </span>
      {stale && (
        <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-500">
          Stale
        </Badge>
      )}
      {status?.ok === false && (
        <span className="flex min-w-0 items-center gap-1 text-destructive" title={status.error ?? 'Unknown parse error'}>
          <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="max-w-[42rem] truncate">
            Last parse failed {formatWorldClock(status.finished_at)} — {status.error ?? 'unknown error'}
          </span>
        </span>
      )}
      {error && status?.ok !== false && (
        <span className="max-w-[32rem] truncate text-destructive" title={error}>{error}</span>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 border-border/60 bg-muted/20 font-mono text-[10px] uppercase tracking-[0.14em]"
        onClick={() => void refresh().catch(() => undefined)}
        disabled={isRefreshing}
      >
        <RefreshCwIcon className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Refreshing' : 'Refresh world'}
      </Button>
    </div>
  )
}
