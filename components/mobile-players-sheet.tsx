'use client'

import { useMemo, useState } from 'react'
import { useServer } from '@/lib/server-context'
import { useTranslation } from '@/lib/i18n/i18n-context'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { toast } from 'sonner'
import {
  UsersIcon,
  RefreshCwIcon,
  SearchIcon,
  WifiIcon,
  BanIcon,
  UserXIcon,
  UnlockIcon,
} from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { getPlayerKey, normalizePlayersPayload } from '@/lib/palworld'
import { getPlayerAvatarColor } from '@/lib/player-avatar-colors'
import type { Player } from '@/lib/types'

interface MobilePlayersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

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

export function MobilePlayersSheet({ open, onOpenChange }: MobilePlayersSheetProps) {
  const { players, apiCall, setPlayers, isLoading, addBannedPlayer, bannedPlayers, removeBannedPlayer } = useServer()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [confirmAction, setConfirmAction] = useState<{ type: 'kick' | 'ban'; player: Player } | null>(null)

  const fetchPlayers = async () => {
    try {
      const payload = await apiCall<unknown>('players')
      setPlayers(normalizePlayersPayload(payload))
    } catch {
      // Error logged in apiCall
    }
  }

  const handleKick = async (player: Player) => {
    if (!player.userId) {
      toast.error(t('players.cannotKickThisPlayer'))
      setConfirmAction(null)
      return
    }

    try {
      await apiCall('kick', 'POST', { userid: player.userId })
      toast.success(t('players.kicked', { name: player.name }))
      await fetchPlayers()
    } catch {
      toast.error(t('players.failedKick', { name: player.name }))
    } finally {
      setConfirmAction(null)
    }
  }

  const handleBan = async (player: Player) => {
    if (!player.userId) {
      toast.error(t('players.cannotBanThisPlayer'))
      setConfirmAction(null)
      return
    }

    try {
      await apiCall('ban', 'POST', { userid: player.userId })
      addBannedPlayer({ name: player.name, steamId: player.userId, bannedAt: new Date().toISOString() })
      toast.success(t('players.banned', { name: player.name }))
      await fetchPlayers()
    } catch {
      toast.error(t('players.failedBan', { name: player.name }))
    } finally {
      setConfirmAction(null)
    }
  }

  const handleUnban = async (player: Player) => {
    if (!player.userId) {
      toast.error(t('players.cannotUnbanThisPlayer'))
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

  const filteredPlayers = useMemo(() => {
    if (!searchQuery) {
      return players
    }

    return players.filter((player) =>
      player.name.toLowerCase().includes(searchQuery) ||
      player.userId.toLowerCase().includes(searchQuery) ||
      player.accountName.toLowerCase().includes(searchQuery)
    )
  }, [players, searchQuery])

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[82vh] rounded-t-2xl p-0 sm:h-[70vh]"
          closeButtonClassName="top-4 right-4 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/80 p-0 opacity-100 shadow-xs hover:bg-muted focus:ring-[3px]"
          closeIconClassName="h-4 w-4"
        >
          <SheetHeader className="border-b border-border px-4 pb-3 pt-4 pr-14">
            <SheetTitle className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-primary" />
                {t('players.onlinePlayersCount', { n: players.length })}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={fetchPlayers}
                disabled={isLoading['players']}
                className="h-8 w-8"
              >
                {isLoading['players'] ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <RefreshCwIcon className="h-4 w-4" />
                )}
              </Button>
            </SheetTitle>
            <div className="relative mt-3">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('players.searchPlaceholder')}
                className="h-9 pl-9 text-sm"
              />
            </div>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1 px-4 pb-4">
            {filteredPlayers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                  <UsersIcon className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? t('players.noMatchingPlayers') : t('players.noPlayersOnline')}
                </p>
              </div>
            ) : (
              <div className="space-y-2 pt-4">
                {filteredPlayers.map((player) => {
                  const isBanned = bannedPlayerIds.has(player.userId)
                  const ping = Math.floor(player.ping ?? 0)
                  const avatarColor = getPlayerAvatarColor(getPlayerKey(player))

                  return (
                    <div
                      key={getPlayerKey(player)}
                      className={`rounded-xl border p-3 ${isBanned ? 'border-destructive/40 bg-destructive/5' : 'border-border/60 bg-card/40'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`avatar-circle mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 ${isBanned ? 'ring-1 ring-destructive/60' : ''}`}
                          style={{ backgroundColor: avatarColor }}
                        >
                          <span className="font-mono text-base font-semibold text-white">
                            {getPlayerInitial(player.name)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-sm font-medium text-foreground">{player.name}</p>
                            {isBanned && (
                              <span className="shrink-0 rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                                {t('players.bannedBadge')}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {player.accountName || t('players.fieldOperator')} · {t('players.levelValue', { level: player.level || t('players.na') })}
                          </p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <WifiIcon className={`h-3 w-3 ${getPingColor(ping)}`} />
                            <span className={getPingColor(ping)}>{ping}ms</span>
                            {player.userId && <span className="truncate">· {player.userId}</span>}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        {isBanned ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            disabled={!player.userId || isLoading['unban']}
                            onClick={() => void handleUnban(player)}
                          >
                            {isLoading['unban'] ? <Spinner className="h-3.5 w-3.5" /> : <UnlockIcon className="h-3.5 w-3.5" />}
                            {t('players.unban')}
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              disabled={!player.userId || isLoading['kick'] || isLoading['ban']}
                              onClick={() => setConfirmAction({ type: 'kick', player })}
                            >
                              <UserXIcon className="h-3.5 w-3.5" />
                              {t('players.kick')}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex-1"
                              disabled={!player.userId || isLoading['ban'] || isLoading['kick']}
                              onClick={() => setConfirmAction({ type: 'ban', player })}
                            >
                              <BanIcon className="h-3.5 w-3.5" />
                              {t('players.ban')}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.type === 'kick' ? t('players.kickPlayer') : t('players.banPlayer')}</AlertDialogTitle>
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
                if (!confirmAction) {
                  return
                }

                if (confirmAction.type === 'kick') {
                  void handleKick(confirmAction.player)
                } else {
                  void handleBan(confirmAction.player)
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
