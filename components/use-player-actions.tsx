'use client'

import { useState, type ReactNode } from 'react'
import { useServer } from '@/lib/server-context'
import { useTranslation } from '@/lib/i18n/i18n-context'
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
import type { Player } from '@/lib/types'

// Shared player kick/ban/unban actions + confirmation dialog. Extracted from
// PlayerRoster (2026-07-10) so the live chat feed can action players the exact
// same way. Returns the handlers plus a ready-to-render confirmation dialog;
// callers wire kick/ban to setConfirmAction and render {confirmDialog}.
export function usePlayerActions(onAfterAction?: () => void) {
  const { apiCall, addBannedPlayer, removeBannedPlayer } = useServer()
  const { t } = useTranslation()
  const [confirmAction, setConfirmAction] = useState<{ type: 'kick' | 'ban'; player: Player } | null>(null)

  const handleKick = async (player: Player) => {
    if (!player.userId) {
      toast.error(t('playerActions.kickMissingUserId', { name: player.name }))
      setConfirmAction(null)
      return
    }
    try {
      await apiCall('kick', 'POST', { userid: player.userId })
      toast.success(t('playerActions.kicked', { name: player.name }))
      onAfterAction?.()
    } catch {
      toast.error(t('playerActions.kickFailed', { name: player.name }))
    }
    setConfirmAction(null)
  }

  const handleBan = async (player: Player) => {
    if (!player.userId) {
      toast.error(t('playerActions.banMissingUserId', { name: player.name }))
      setConfirmAction(null)
      return
    }
    try {
      await apiCall('ban', 'POST', { userid: player.userId })
      addBannedPlayer({ name: player.name, steamId: player.userId, bannedAt: new Date().toISOString() })
      toast.success(t('playerActions.banned', { name: player.name }))
      onAfterAction?.()
    } catch {
      toast.error(t('playerActions.banFailed', { name: player.name }))
    }
    setConfirmAction(null)
  }

  const handleUnban = async (player: Player) => {
    if (!player.userId) {
      toast.error(t('playerActions.unbanMissingUserId', { name: player.name }))
      return
    }
    try {
      await apiCall('unban', 'POST', { userid: player.userId })
      removeBannedPlayer(player.userId)
      toast.success(t('playerActions.unbanned', { name: player.name }))
    } catch {
      toast.error(t('playerActions.unbanFailed', { name: player.name }))
    }
  }

  const confirmDialog: ReactNode = (
    <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmAction?.type === 'kick' ? t('playerActions.kickTitle') : t('playerActions.banTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {confirmAction?.type === 'kick'
              ? t('playerActions.confirmKick', { name: confirmAction.player.name })
              : confirmAction?.type === 'ban'
                ? t('playerActions.confirmBan', { name: confirmAction.player.name })
                : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (confirmAction?.type === 'kick') handleKick(confirmAction.player)
              else if (confirmAction?.type === 'ban') handleBan(confirmAction.player)
            }}
            className={confirmAction?.type === 'ban' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
          >
            {confirmAction?.type === 'kick' ? t('playerActions.kick') : t('playerActions.ban')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  return { confirmAction, setConfirmAction, handleKick, handleBan, handleUnban, confirmDialog }
}
