'use client'

import { useCallback, useMemo, useState } from 'react'
import { useServer } from '@/lib/server-context'
import { useTranslation } from '@/lib/i18n/i18n-context'
import { Button } from '@/components/ui/button'
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
import { getPlayerKey } from '@/lib/palworld'
import { getPlayerAvatarColor } from '@/lib/player-avatar-colors'
import { toast } from 'sonner'
import {
  MoreVerticalIcon,
  UserIcon,
  BanIcon,
  UnlockIcon,
  WifiIcon,
  EyeIcon,
  CheckIcon
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

interface PlayerRosterProps {
  search: string
  /** Called after a successful kick/ban so the owner can refresh its roster. */
  onAfterAction?: () => void
  /** 'widget' keeps the row action menu always visible for touch screens. */
  variant?: 'sidebar' | 'widget'
  className?: string
}

// Shared personnel ledger: watchlist tier + roster rows with kick/ban/unban
// and watchlist toggle. Rendered by the full-admin sidebar
// (OnlinePlayersPanel) and by the mod-tier ModWidget. Extracted 2026-07-10
// for the two-tier password build — behavior matches the former inline
// sidebar rendering exactly.
// Accounts hidden from the MOD-tier widget only. Exact userId match — admin sidebar shows everyone.
const MOD_WIDGET_HIDDEN_USERIDS = new Set(
  (process.env.NEXT_PUBLIC_MOD_WIDGET_HIDDEN_USERIDS ?? '')
    .split(',')
    .map((userId) => userId.trim())
    .filter(Boolean)
)

export function PlayerRoster({ search, onAfterAction, variant = 'sidebar', className }: PlayerRosterProps) {
  const { apiCall, players, addBannedPlayer, bannedPlayers, removeBannedPlayer } = useServer()
  const { t } = useTranslation()
  const [confirmAction, setConfirmAction] = useState<{ type: 'kick' | 'ban'; player: Player } | null>(null)

  const handleKick = async (player: Player) => {
    if (!player.userId) {
      toast.error(t('players.cannotKickMissingId', { name: player.name }))
      setConfirmAction(null)
      return
    }

    try {
      await apiCall('kick', 'POST', { userid: player.userId })
      toast.success(t('players.kicked', { name: player.name }))
      onAfterAction?.()
    } catch {
      toast.error(t('players.failedKick', { name: player.name }))
    }
    setConfirmAction(null)
  }

  const handleBan = async (player: Player) => {
    if (!player.userId) {
      toast.error(t('players.cannotBanMissingId', { name: player.name }))
      setConfirmAction(null)
      return
    }

    try {
      await apiCall('ban', 'POST', { userid: player.userId })
      addBannedPlayer({ name: player.name, steamId: player.userId, bannedAt: new Date().toISOString() })
      toast.success(t('players.banned', { name: player.name }))
      onAfterAction?.()
    } catch {
      toast.error(t('players.failedBan', { name: player.name }))
    }
    setConfirmAction(null)
  }

  const handleUnban = async (player: Player) => {
    if (!player.userId) {
      toast.error(t('players.cannotUnbanMissingId', { name: player.name }))
      return
    }

    try {
      await apiCall('unban', 'POST', { userid: player.userId })
      removeBannedPlayer(player.userId)
      toast.success(t('players.unbanned', { name: player.name }))
    } catch {
      toast.error(t('players.failedUnban', { name: player.name }))
    }
  }

  const searchQuery = search.trim().toLowerCase()
  const bannedPlayerIds = useMemo(() => new Set(bannedPlayers.map((player) => player.steamId)), [bannedPlayers])

  // Watchlist: operator-flagged players pinned to a top tier (owner order 2026-07-10).
  // Persisted by player key so it survives refreshes and re-joins.
  const [watchlist, setWatchlist] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const raw = localStorage.getItem('playerWatchlist')
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })
  const toggleWatch = useCallback((player: Player) => {
    setWatchlist((prev) => {
      const next = new Set(prev)
      const key = getPlayerKey(player)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      localStorage.setItem('playerWatchlist', JSON.stringify([...next]))
      return next
    })
  }, [])

  const filteredPlayers = useMemo(() => {
    const base = searchQuery
      ? players.filter((player) =>
          player.name.toLowerCase().includes(searchQuery) ||
          player.userId.toLowerCase().includes(searchQuery)
        )
      : players
    const scoped = variant === 'widget'
      ? base.filter((player) => !MOD_WIDGET_HIDDEN_USERIDS.has(player.userId))
      : base
    // Default sort: alphabetical by display name (owner order 2026-07-10)
    return [...scoped].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  }, [players, searchQuery, variant])

  const watchedPlayers = useMemo(() => filteredPlayers.filter((p) => watchlist.has(getPlayerKey(p))), [filteredPlayers, watchlist])
  const regularPlayers = useMemo(() => filteredPlayers.filter((p) => !watchlist.has(getPlayerKey(p))), [filteredPlayers, watchlist])

  // Sidebar keeps the hover-reveal action button; the widget targets phones,
  // where there is no hover — actions stay visible.
  const actionTriggerClass =
    variant === 'widget'
      ? 'h-9 w-9'
      : 'h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity'

  const renderPlayerRow = (player: Player) => {
    const isBanned = bannedPlayerIds.has(player.userId)
    const avatarColor = getPlayerAvatarColor(getPlayerKey(player))
    const watched = watchlist.has(getPlayerKey(player))
    return (
      <div
        key={getPlayerKey(player)}
        className={`flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 transition-colors group ${isBanned ? 'border border-destructive/30 bg-destructive/5' : ''}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
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
              {isBanned && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/15 text-destructive shrink-0">{t('players.bannedBadge')}</span>}
            </div>
            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
              {t('players.lvl', { level: player.level })}
              {player.accountName && player.accountName !== player.name && (
                <><span className="mx-0.5">·</span><span className="truncate max-w-20">{player.accountName}</span></>
              )}
            </p>
          </div>
        </div>
        <div className="flex w-16 shrink-0 items-center justify-end gap-1 font-mono text-xs tabular-nums">
          <span className={getPingColor(Math.floor(player.ping ?? 0))}>{Math.floor(player.ping ?? 0)}ms</span>
          <WifiIcon className={`h-3 w-3 shrink-0 ${getPingColor(Math.floor(player.ping ?? 0))}`} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={actionTriggerClass}
            >
              <MoreVerticalIcon className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => toggleWatch(player)}>
              <EyeIcon className="w-4 h-4 mr-2" />
              {t('players.watchlist')}
              {watched && <CheckIcon className="w-4 h-4 ml-auto text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {!isBanned && (
              <DropdownMenuItem onClick={() => setConfirmAction({ type: 'kick', player })}>
                <UserIcon className="w-4 h-4 mr-2" />
                {t('players.kickPlayer')}
              </DropdownMenuItem>
            )}
            {isBanned ? (
              <DropdownMenuItem onClick={() => handleUnban(player)}>
                <UnlockIcon className="w-4 h-4 mr-2" />
                {t('players.unbanPlayer')}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => setConfirmAction({ type: 'ban', player })}
                className="text-destructive focus:text-destructive"
              >
                <BanIcon className="w-4 h-4 mr-2" />
                {t('players.banPlayer')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <>
      <ScrollArea className={className ?? 'min-h-0 flex-1'}>
        <div className="p-2">
          {filteredPlayers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {search ? t('players.noPlayersFound') : t('players.noPlayersOnline')}
            </div>
          ) : (
            <div className="space-y-1">
              {watchedPlayers.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 px-1 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary/80">
                    <EyeIcon className="h-3 w-3" /> {t('players.watchlist')}
                  </div>
                  {watchedPlayers.map((player) => renderPlayerRow(player))}
                  <div className="my-1.5 border-t border-border/40" />
                </>
              )}
              {regularPlayers.map((player) => renderPlayerRow(player))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'kick' ? t('players.kickPlayer') : t('players.banPlayer')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('players.confirmActionQuestion', {
                action: confirmAction?.type === 'ban' ? t('players.actionBan') : t('players.actionKick'),
                name: confirmAction?.player.name ?? '',
              })}
              {confirmAction?.type === 'ban' && ` ${t('players.banReversible')}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
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
              {confirmAction?.type === 'kick' ? t('players.kick') : t('players.ban')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
