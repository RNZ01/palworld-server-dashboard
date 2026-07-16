'use client'

import { useEffect, useRef, useState } from 'react'
import { useServer } from '@/lib/server-context'
import { useTranslation } from '@/lib/i18n/i18n-context'
import { buildPalworldProxyHeaders } from '@/lib/palworld'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldLabel } from '@/components/ui/field'
import { toast } from 'sonner'

const MIN_LEN = 6

export function PanelSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { config, setConfig } = useServer()
  const { t } = useTranslation()

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [modPw, setModPw] = useState('')
  const [modEnabled, setModEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Click outside the dialog closes it (AlertDialog blocks outside-close by default).
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
        onOpenChange(false)
      }
    }
    const id = window.setTimeout(() => document.addEventListener('mousedown', onDown), 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) {
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      setModPw('')
      return
    }
    if (!config) return
    fetch('/api/panel-auth/mod-password', { headers: buildPalworldProxyHeaders(config), cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.modEnabled === 'boolean') setModEnabled(d.modEnabled)
      })
      .catch(() => {})
  }, [open, config])

  const changeAdminPassword = async () => {
    if (newPw.length < MIN_LEN) {
      toast.error(t('settings.newPasswordMinLength', { min: MIN_LEN }))
      return
    }
    if (newPw !== confirmPw) {
      toast.error(t('settings.passwordsMismatch'))
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/panel-auth/admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || t('settings.changePasswordFailed'))
        return
      }
      // Keep the current session alive under the new credential.
      if (config) setConfig({ ...config, adminPassword: newPw })
      toast.success(t('settings.adminPasswordChanged'))
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    } catch {
      toast.error(t('settings.changePasswordFailed'))
    } finally {
      setBusy(false)
    }
  }

  const submitMod = async (disable: boolean) => {
    if (!config) return
    if (!disable && modPw.length < MIN_LEN) {
      toast.error(t('settings.modPasswordMinLength', { min: MIN_LEN }))
      return
    }
    setBusy(true)
    try {
      const headers = new Headers(buildPalworldProxyHeaders(config))
      headers.set('Content-Type', 'application/json')
      const res = await fetch('/api/panel-auth/mod-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({ modPassword: disable ? null : modPw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || t('settings.updateModAccessFailed'))
        return
      }
      const wasEnabled = modEnabled
      setModEnabled(!disable)
      setModPw('')
      toast.success(disable ? t('settings.modAccessDisabled') : wasEnabled ? t('settings.modPasswordUpdated') : t('settings.modAccessEnabled'))
    } catch {
      toast.error(t('settings.updateModAccessFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent ref={contentRef} className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-mono uppercase tracking-[0.2em]">{t('settings.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('settings.description')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-5">
          {/* Admin password */}
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/80">{t('settings.adminPasswordSection')}</p>
            <div className="space-y-1">
              <FieldLabel htmlFor="panel-cur-pw">{t('settings.currentPassword')}</FieldLabel>
              <Input id="panel-cur-pw" type="password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="panel-new-pw">{t('settings.newPassword')}</FieldLabel>
              <Input id="panel-new-pw" type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <div className="space-y-1">
              <FieldLabel htmlFor="panel-conf-pw">{t('settings.confirmNewPassword')}</FieldLabel>
              <Input id="panel-conf-pw" type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </div>
            <Button size="sm" onClick={changeAdminPassword} disabled={busy || !currentPw || !newPw} className="w-full">
              {t('settings.changeAdminPassword')}
            </Button>
          </section>

          <div className="h-px bg-border/60" />

          {/* Mod access */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/80">{t('settings.modAccessSection')}</p>
              <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${modEnabled ? 'text-primary' : 'text-muted-foreground'}`}>
                {modEnabled ? t('settings.enabled') : t('settings.disabled')}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t('settings.modAccessDescription')}
            </p>
            <div className="space-y-1">
              <FieldLabel htmlFor="panel-mod-pw">{modEnabled ? t('settings.newModPassword') : t('settings.modPassword')}</FieldLabel>
              <Input id="panel-mod-pw" type="password" autoComplete="new-password" value={modPw} onChange={(e) => setModPw(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => submitMod(false)} disabled={busy || modPw.length < MIN_LEN} className="flex-1">
                {modEnabled ? t('settings.updatePassword') : t('settings.enableModAccess')}
              </Button>
              {modEnabled && (
                <Button size="sm" variant="outline" onClick={() => submitMod(true)} disabled={busy} className="flex-1 !border-red-500/60 !text-red-300 hover:!bg-red-500/15">
                  {t('settings.disable')}
                </Button>
              )}
            </div>
          </section>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t('common.close')}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
