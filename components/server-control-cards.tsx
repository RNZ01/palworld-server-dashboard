'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { InfoPanel } from '@/components/status-bar'
import { useServer } from '@/lib/server-context'
import { useTranslation } from '@/lib/i18n/i18n-context'
import { buildPalworldProxyHeaders } from '@/lib/palworld'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldLabel } from '@/components/ui/field'
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
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import {
  SaveIcon,
  PowerIcon,
  PlayIcon,
  StopCircleIcon,
  SearchIcon
} from 'lucide-react'

const FPS_HISTORY_WINDOW_MS = 1 * 60 * 60 * 1000 // owner 2026-07-13: 1h (was 4h) — keep in sync with lib/server-context.tsx
// History comes from the server-side sampler (5s cadence). A hole >30s in the
// ring means the server (or sampler) was actually down — render it as a GAP,
// never a fake bridging line across time nobody sampled.
const FPS_GAP_BREAK_MS = 30_000
const FPS_SAMPLE_NOMINAL_MS = 5_000 // sampler cadence — one sample ≈ 5s of wall time
// Owner-ordered health tiles (2026-07-14), thresholds per the watch-signal doctrine:
// median sliding off baseline = structural sag; longest continuous <45 stretch
// growing past ~60-90s = dips becoming valleys; >10% of the hour under 30 = budget blown.
const FPS_DIP_THRESHOLD = 45

// Translator function shape from useTranslation(); passed into module-level
// builders/helpers that produce user-facing strings.
type Translate = (path: string, params?: Record<string, string | number>) => string

export function PanelSection({
  title,
  subtitle,
  status = 'active',
  className,
  contentClassName,
  children,
}: {
  title: string
  subtitle: string
  status?: 'active' | 'pending' | 'complete'
  className?: string
  contentClassName?: string
  children: React.ReactNode
}) {
  return (
    <InfoPanel title={title} subtitle={subtitle} status={status} className={cn('h-full min-h-[18rem]', className)}>
      <div className={cn('mt-2 space-y-4', contentClassName)}>{children}</div>
    </InfoPanel>
  )
}

interface PresetMessage {
  label: string
  message: string
  reminders?: { delayMs: number; message: string }[]
  tone?: 'warning' | 'success' | 'info' | 'neutral'
}

const QUICK_MESSAGE_TONE_CLASS: Record<NonNullable<PresetMessage['tone']>, string> = {
  warning: '!border-amber-500/60 !bg-amber-500/12 !text-amber-200 hover:!bg-amber-500/22 hover:!text-amber-100',
  success: '!border-emerald-500/60 !bg-emerald-500/12 !text-emerald-200 hover:!bg-emerald-500/22 hover:!text-emerald-100',
  info: '!border-cyan-500/60 !bg-cyan-500/12 !text-cyan-200 hover:!bg-cyan-500/22 hover:!text-cyan-100',
  neutral: '!border-border !bg-secondary/35 !text-foreground/90 hover:!bg-secondary/55',
}

function getQuickMessageToneClass(preset: PresetMessage) {
  return QUICK_MESSAGE_TONE_CLASS[preset.tone ?? 'neutral']
}

function buildRestartPresets(t: Translate): PresetMessage[] {
  return [
    {
      label: t('serverControl.management.restart.presets.min1.label'),
      message: t('serverControl.management.restart.presets.min1.message'),
      tone: 'warning',
      reminders: [
        { delayMs: 30_000, message: t('serverControl.management.restart.reminders.sec30') },
        { delayMs: 50_000, message: t('serverControl.management.restart.reminders.sec10') },
      ],
    },
    {
      label: t('serverControl.management.restart.presets.min5.label'),
      message: t('serverControl.management.restart.presets.min5.message'),
      tone: 'warning',
      reminders: [
        { delayMs:  60_000, message: t('serverControl.management.restart.reminders.min4') },
        { delayMs: 120_000, message: t('serverControl.management.restart.reminders.min3') },
        { delayMs: 180_000, message: t('serverControl.management.restart.reminders.min2') },
        { delayMs: 240_000, message: t('serverControl.management.restart.reminders.min1') },
        { delayMs: 270_000, message: t('serverControl.management.restart.reminders.sec30') },
        { delayMs: 290_000, message: t('serverControl.management.restart.reminders.sec10') },
      ],
    },
    {
      label: t('serverControl.management.restart.presets.min10.label'),
      message: t('serverControl.management.restart.presets.min10.message'),
      tone: 'warning',
      reminders: [
        { delayMs: 300_000, message: t('serverControl.management.restart.reminders.min5') },
        { delayMs: 480_000, message: t('serverControl.management.restart.reminders.min2excl') },
        { delayMs: 540_000, message: t('serverControl.management.restart.reminders.min1') },
        { delayMs: 570_000, message: t('serverControl.management.restart.reminders.sec30') },
        { delayMs: 590_000, message: t('serverControl.management.restart.reminders.sec10') },
      ],
    },
  ]
}

// Quick messages grouped for the Announcements card: info/status first,
// then event/gameplay callouts, then maintenance/warning-adjacent last.
function buildQuickMessageGroups(t: Translate): { label: string; presets: PresetMessage[] }[] {
  return [
    {
      label: t('serverControl.announce.groups.info'),
      presets: [
        { label: t('serverControl.announce.presets.adminOnline.label'),     message: t('serverControl.announce.presets.adminOnline.message'), tone: 'info' },
        { label: t('serverControl.announce.presets.rulesReminder.label'),   message: t('serverControl.announce.presets.rulesReminder.message'), tone: 'info' },
        { label: t('serverControl.announce.presets.saveComplete.label'),    message: t('serverControl.announce.presets.saveComplete.message'), tone: 'success' },
        { label: t('serverControl.announce.presets.backupComplete.label'),  message: t('serverControl.announce.presets.backupComplete.message'), tone: 'success' },
        { label: t('serverControl.announce.presets.restartComplete.label'), message: t('serverControl.announce.presets.restartComplete.message'), tone: 'success' },
      ],
    },
    {
      label: t('serverControl.announce.groups.events'),
      presets: [
        { label: t('serverControl.announce.presets.pvpSoon.label'),   message: t('serverControl.announce.presets.pvpSoon.message'), tone: 'info' },
        { label: t('serverControl.announce.presets.serverFullSoon.label'), message: t('serverControl.announce.presets.serverFullSoon.message'), tone: 'warning' },
      ],
    },
    {
      label: t('serverControl.announce.groups.maintenance'),
      presets: [
        { label: t('serverControl.announce.presets.prepareToSave.label'),   message: t('serverControl.announce.presets.prepareToSave.message'), tone: 'warning' },
        { label: t('serverControl.announce.presets.backupRunning.label'),    message: t('serverControl.announce.presets.backupRunning.message'), tone: 'warning' },
        { label: t('serverControl.announce.presets.highLatency.label'),      message: t('serverControl.announce.presets.highLatency.message'), tone: 'warning' },
        { label: t('serverControl.announce.presets.maintenanceSoon.label'),  message: t('serverControl.announce.presets.maintenanceSoon.message'), tone: 'warning' },
        { label: t('serverControl.announce.presets.adminMaintenance.label'), message: t('serverControl.announce.presets.adminMaintenance.message'), tone: 'warning' },
      ],
    },
  ]
}

// Hover/focus popover previewing the exact message a quick-send button fires.
// Portalled to <body> so it escapes the card's `overflow-hidden` clipping; no
// external tooltip dependency, and it works for mouse hover and keyboard focus.
function QuickSendButton({
  preset,
  disabled,
  onSend,
}: {
  preset: PresetMessage
  disabled?: boolean
  onSend: (preset: PresetMessage) => void
}) {
  const { t } = useTranslation()
  const triggerRef = useRef<HTMLSpanElement | null>(null)
  const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null)

  const showTip = () => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setTipPos({ left: rect.left + rect.width / 2, top: rect.top })
  }
  const hideTip = () => setTipPos(null)

  return (
    <span
      ref={triggerRef}
      className="inline-flex"
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
      onFocus={showTip}
      onBlur={hideTip}
    >
      <Button
        onClick={() => onSend(preset)}
        disabled={disabled}
        type="button"
        variant="outline"
        size="sm"
        aria-label={t('serverControl.announce.sendAria', { message: preset.message })}
        className={cn(
          'h-auto whitespace-normal px-2 py-1 text-left text-xs',
          getQuickMessageToneClass(preset)
        )}
      >
        {preset.label}
      </Button>
      {tipPos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            style={{ left: tipPos.left, top: tipPos.top }}
            className="pointer-events-none fixed z-[120] -mt-2 w-max max-w-[20rem] -translate-x-1/2 -translate-y-full rounded border border-border bg-card/95 px-2.5 py-1.5 font-mono text-[11px] leading-snug text-foreground shadow-xl backdrop-blur-sm"
          >
            {preset.message}
          </div>,
          document.body
        )}
    </span>
  )
}

export function AnnouncementCard() {
  const { apiCall, isLoading } = useServer()
  const { t } = useTranslation()
  const sending = !!isLoading['announce']
  const quickMessageGroups = buildQuickMessageGroups(t)

  const sendPreset = async (preset: PresetMessage) => {
    try {
      await apiCall('announce', 'POST', { message: preset.message })
      toast.success(t('serverControl.announce.sent'))
    } catch {
      toast.error(t('serverControl.announce.sendFailed'))
    }
  }

  return (
    <PanelSection title={t('serverControl.announce.title')} subtitle={t('serverControl.announce.subtitle')} status="active">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t('serverControl.announce.quickMessages')}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground/80">
            {t('serverControl.announce.quickHint')}
          </p>
          <div className="space-y-2.5">
            {quickMessageGroups.map((group) => (
              <div key={group.label} className="space-y-1">
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.presets.map((preset) => (
                    <QuickSendButton
                      key={preset.label}
                      preset={preset}
                      disabled={sending}
                      onSend={sendPreset}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
    </PanelSection>
  )
}

export function ServerManagementCard() {
  const { apiCall, isLoading, config, connectionStatus } = useServer()
  const { t } = useTranslation()
  const restartPresets = buildRestartPresets(t)
  const [confirmAction, setConfirmAction] = useState<'shutdown' | 'stop' | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [activeSchedule, setActiveSchedule] = useState<{ label: string; endsAt: number } | null>(null)
  const [remaining, setRemaining] = useState(0)
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([])

  // Only a confirmed 'disconnected' means the server is off; 'checking' is a
  // transient poll state and stays "online" to avoid the button flickering.
  const serverOnline = connectionStatus !== 'disconnected'

  // Clear the transient "starting…" state once the server answers REST again,
  // or after a safety timeout if it never comes up (e.g. start failed on host).
  useEffect(() => {
    if (serverOnline && isStarting) setIsStarting(false)
  }, [serverOnline, isStarting])
  useEffect(() => {
    if (!isStarting) return
    const id = setTimeout(() => setIsStarting(false), 120_000)
    return () => clearTimeout(id)
  }, [isStarting])

  useEffect(() => {
    if (!activeSchedule) return
    const iv = setInterval(() => {
      const left = Math.max(0, activeSchedule.endsAt - Date.now())
      setRemaining(left)
      if (left === 0) {
        setActiveSchedule(null)
        clearInterval(iv)
      }
    }, 500)
    return () => clearInterval(iv)
  }, [activeSchedule])

  const clearScheduleTimers = () => {
    timerRefs.current.forEach(clearTimeout)
    timerRefs.current = []
    setActiveSchedule(null)
  }

  useEffect(() => {
    return () => {
      timerRefs.current.forEach(clearTimeout)
      timerRefs.current = []
    }
  }, [])

  const announceSilently = async (text: string) => {
    try {
      await apiCall('announce', 'POST', { message: text })
    } catch {
      // Silently fail announcement
    }
  }

  const triggerServerRestart = async (waittimeSec: number, message: string): Promise<boolean> => {
    if (!config) return false
    const headers = new Headers(buildPalworldProxyHeaders(config))
    headers.set('Content-Type', 'application/json')
    const res = await fetch('/api/server-restart', {
      method: 'POST',
      headers,
      cache: 'no-store',
      body: JSON.stringify({ waittime: waittimeSec, message }),
    })
    return res.ok
  }

  const scheduleRestart = async (preset: PresetMessage) => {
    const lastReminderMs = preset.reminders?.length
      ? preset.reminders[preset.reminders.length - 1].delayMs
      : 0
    const waittimeMs = lastReminderMs + 10_000

    clearScheduleTimers()
    try {
      const ok = await triggerServerRestart(Math.round(waittimeMs / 1000), preset.message)
      if (!ok) {
        toast.error(t('serverControl.management.restart.scheduleFailedIntegration'))
        return
      }
      setActiveSchedule({ label: preset.label, endsAt: Date.now() + waittimeMs })
      setRemaining(waittimeMs)
      toast.success(t('serverControl.management.restart.scheduled'))
    } catch {
      toast.error(t('serverControl.management.restart.scheduleFailed'))
    }
  }

  const cancelRestartSchedule = async () => {
    clearScheduleTimers()
    if (!config) {
      toast.info(t('serverControl.management.restart.cancelled'))
      return
    }
    try {
      const headers = new Headers(buildPalworldProxyHeaders(config))
      await fetch('/api/server-restart', { method: 'DELETE', headers, cache: 'no-store' })
      toast.success(t('serverControl.management.restart.cancelledNotified'))
    } catch {
      toast.info(t('serverControl.management.restart.cancelFailed'))
    }
  }

  const formatRemaining = (ms: number) => {
    const s = Math.ceil(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

  const saveWorldAndAnnounce = async (): Promise<boolean> => {
    try {
      await apiCall('save', 'POST')
      await announceSilently(t('serverControl.management.announce.worldSaved'))
      toast.success(t('serverControl.management.toast.worldSaved'))
      return true
    } catch {
      toast.error(t('serverControl.management.toast.saveFailed'))
      return false
    }
  }

  const saveWorld = async () => {
    await saveWorldAndAnnounce()
  }

  const shutdownServer = async () => {
    setIsProcessing(true)
    try {
      // First save the world
      const saved = await saveWorldAndAnnounce()
      if (!saved) {
        setIsProcessing(false)
        setConfirmAction(null)
        return
      }
      
      // Announce shutdown
      await announceSilently(t('serverControl.management.announce.shutdownSoon'))
      toast.info(t('serverControl.management.toast.shutdownAnnounced'))

      // Wait 10 seconds then shutdown
      await new Promise(resolve => setTimeout(resolve, 10000))

      await apiCall('shutdown', 'POST', { waittime: 1 })
      toast.success(t('serverControl.management.toast.shutdownInitiated'))
    } catch {
      toast.error(t('serverControl.management.toast.shutdownFailed'))
    }
    setIsProcessing(false)
    setConfirmAction(null)
  }

  const stopServer = async () => {
    setIsProcessing(true)
    try {
      // First save the world
      const saved = await saveWorldAndAnnounce()
      if (!saved) {
        setIsProcessing(false)
        setConfirmAction(null)
        return
      }
      
      // Announce stop
      await announceSilently(t('serverControl.management.announce.forceStopping'))

      await apiCall('stop', 'POST')
      toast.success(t('serverControl.management.toast.stopped'))
    } catch {
      toast.error(t('serverControl.management.toast.stopFailed'))
    }
    setIsProcessing(false)
    setConfirmAction(null)
  }

  // Starting a stopped server can't go through the game REST API (it's down):
  // this hits the host power route, which drops a `start` flag consumed by the
  // root worker running `systemctl start palworld.service`.
  const startServer = async () => {
    if (!config) return
    setIsStarting(true)
    try {
      const headers = new Headers(buildPalworldProxyHeaders(config))
      headers.set('Content-Type', 'application/json')
      const res = await fetch('/api/server-power', {
        method: 'POST',
        headers,
        cache: 'no-store',
        body: JSON.stringify({ action: 'start' }),
      })
      if (!res.ok) {
        setIsStarting(false)
        toast.error(t('serverControl.management.startFailed'))
        return
      }
      toast.success(t('serverControl.management.startInitiated'))
    } catch {
      setIsStarting(false)
      toast.error(t('serverControl.management.startFailed'))
    }
  }

    return (
      <>
      <PanelSection
        title={t('serverControl.management.title')}
        subtitle={t('serverControl.management.subtitle')}
        status={isProcessing || activeSchedule ? 'pending' : 'active'}
        contentClassName="mt-0 flex flex-1 flex-col gap-3"
      >
          {activeSchedule && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="status-dot h-2 w-2 shrink-0 animate-pulse rounded-full bg-warning" />
                <span className="text-warning font-medium">{activeSchedule.label}</span>
                <span className="text-muted-foreground">
                  {t('serverControl.management.restart.nextReminder')}{' '}
                  <span className="font-mono font-semibold text-foreground">{formatRemaining(remaining)}</span>
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                onClick={cancelRestartSchedule}
              >
                {t('common.cancel')}
              </Button>
            </div>
          )}

          {serverOnline && (
          <div className="space-y-1.5 rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5">
            <p className="text-[11px] font-semibold text-amber-300">{t('serverControl.management.restart.heading')}</p>
            <p className="text-[10px] leading-relaxed text-amber-200/85">
              {t('serverControl.management.restart.description')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {restartPresets.map((preset) => (
                <Button
                  key={preset.label}
                  onClick={() => scheduleRestart(preset)}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto whitespace-normal px-2 py-1 text-left text-xs"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          )}

          <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
          {serverOnline ? (
          <>
          <Button
            onClick={saveWorld}
            disabled={isLoading['save'] || isProcessing}
            variant="outline"
            className="w-full !border-emerald-500/60 !bg-emerald-500/12 !text-emerald-200 hover:!bg-emerald-500/22 hover:!text-emerald-100"
          >
            {isLoading['save'] ? <Spinner className="w-4 h-4 mr-2" /> : <SaveIcon className="w-4 h-4 mr-2" />}
            {t('serverControl.management.saveWorld')}
          </Button>
          <Button
            onClick={() => setConfirmAction('shutdown')}
            disabled={isProcessing}
            variant="outline"
            className="w-full !border-amber-500/60 !bg-amber-500/12 !text-amber-200 hover:!bg-amber-500/22 hover:!text-amber-100"
          >
            <PowerIcon className="w-4 h-4 mr-2" />
            {t('serverControl.management.shutdown')}
          </Button>
          <Button
            onClick={() => setConfirmAction('stop')}
            disabled={isProcessing}
            variant="outline"
            className="w-full !border-red-500/65 !bg-red-500/14 !text-red-200 hover:!bg-red-500/24 hover:!text-red-100"
          >
            <StopCircleIcon className="w-4 h-4 mr-2" />
            {t('serverControl.management.forceStop')}
          </Button>
          </>
          ) : (
          <>
          <p className="text-center text-xs text-muted-foreground">{t('serverControl.management.offlineHint')}</p>
          <Button
            onClick={startServer}
            disabled={isStarting}
            variant="outline"
            className="w-full !border-emerald-500/60 !bg-emerald-500/12 !text-emerald-200 hover:!bg-emerald-500/22 hover:!text-emerald-100"
          >
            {isStarting ? <Spinner className="w-4 h-4 mr-2" /> : <PlayIcon className="w-4 h-4 mr-2" />}
            {isStarting ? t('serverControl.management.starting') : t('serverControl.management.start')}
          </Button>
          </>
          )}
          </div>
      </PanelSection>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !isProcessing && !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'shutdown' ? t('serverControl.management.confirmShutdownTitle') : t('serverControl.management.confirmStopTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'shutdown'
                ? t('serverControl.management.confirmShutdownDesc')
                : t('serverControl.management.confirmStopDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction === 'shutdown' ? shutdownServer : stopServer}
              disabled={isProcessing}
              className={confirmAction === 'stop' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-warning text-warning-foreground hover:bg-warning/90'}
            >
              {isProcessing ? <Spinner className="w-4 h-4 mr-2" /> : null}
              {confirmAction === 'shutdown' ? (isProcessing ? t('serverControl.management.shuttingDown') : t('serverControl.management.shutdownAction')) : (isProcessing ? t('serverControl.management.stopping') : t('serverControl.management.forceStop'))}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function BanManagementCard() {
  const { apiCall, isLoading, bannedPlayers, removeBannedPlayer } = useServer()
  const { t } = useTranslation()

  const handleUnban = async (steamId: string) => {
    try {
      await apiCall('unban', 'POST', { userid: steamId })
      removeBannedPlayer(steamId)
      toast.success(t('serverControl.ban.unbanned'))
    } catch {
      toast.error(t('serverControl.ban.unbanFailed'))
    }
  }

  return (
    <PanelSection title={t('serverControl.ban.title')} subtitle={t('serverControl.ban.subtitle')} status={bannedPlayers.length > 0 ? 'pending' : 'active'} className="min-h-[34rem]">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('serverControl.ban.bannedPlayers', { count: bannedPlayers.length })}</p>
          {bannedPlayers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">{t('serverControl.ban.noBanned')}</p>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {bannedPlayers.map((banned) => (
                <div key={banned.steamId} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-secondary/50 border border-border">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{banned.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{banned.steamId}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-7 px-2 text-xs border-border"
                    disabled={isLoading['unban']}
                    onClick={() => handleUnban(banned.steamId)}
                  >
                    {isLoading['unban'] ? <Spinner className="w-3 h-3" /> : t('serverControl.ban.unban')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
    </PanelSection>
  )
}

function formatAxisAge(ms: number) {
  if (ms < 60_000) return `-${Math.max(1, Math.round(ms / 1000))}s`
  if (ms < 3_600_000) return `-${Math.round(ms / 60_000)}m`
  const hours = Math.round((ms / 3_600_000) * 10) / 10
  return `-${Number.isInteger(hours) ? hours.toFixed(0) : hours.toFixed(1)}h`
}

// ── General health verdict (owner order 2026-07-14) ─────────────────────────
// One pill, one color, beside the live FPS. Composite 0-100 score: a weighted
// blend of five signals (structural hour-median heaviest, a 10-min median for
// recency), then VETO CAPS — any single critical signal alone clamps the
// verdict ("one bad metric can mean bad"), while several mildly-soft signals
// drag the blend down together ("enough low-ish metrics also mean bad").
// Calibrated to the public-server band doctrine: sustained <30 = action
// needed, <20-25 = broken; short 30s bursts are normal sim spikes.

const HEALTH_RECENT_WINDOW_MS = 10 * 60 * 1000
const HEALTH_MIN_SAMPLES = 60 // ~5 min of ring data before a verdict is rendered

// fps -> score (piecewise linear between anchors)
const HEALTH_FPS_ANCHORS: Array<[number, number]> = [
  [0, 0], [20, 10], [30, 25], [35, 40], [40, 50], [45, 60], [50, 75], [55, 90], [60, 100],
]
// % of hour under 30fps -> score
const HEALTH_BUDGET_ANCHORS: Array<[number, number]> = [
  [0, 100], [2, 90], [5, 75], [10, 55], [15, 35], [25, 15], [40, 0],
]
// longest continuous <45fps stretch (ms) -> score
const HEALTH_DIP_ANCHORS: Array<[number, number]> = [
  [0, 100], [15_000, 95], [30_000, 85], [60_000, 70], [90_000, 50], [180_000, 25], [300_000, 0],
]

function rampScore(anchors: Array<[number, number]>, value: number) {
  if (value <= anchors[0][0]) return anchors[0][1]
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1]
    const [x1, y1] = anchors[i]
    if (value <= x1) {
      return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return anchors[anchors.length - 1][1]
}

function medianOf(values: number[]) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

interface FpsHealthInput {
  currentFps: number | null
  hourMedian: number | null
  recentMedian: number | null
  lastMinuteMedian: number | null
  hourAvg: number | null
  under30Pct: number | null
  longestDipMs: number | null
  sampleCount: number
  newestSampleAgeMs: number
}

interface FpsHealthVerdict {
  score: number | null
  label: string
  colorClass: string
  detail: string
}

function computeFpsHealth(input: FpsHealthInput, t: Translate): FpsHealthVerdict {
  const muted = 'text-muted-foreground'

  if (input.sampleCount === 0 && input.currentFps == null) {
    return { score: null, label: t('serverControl.metrics.health.noData'), colorClass: muted, detail: t('serverControl.metrics.health.noDataDetail') }
  }
  if (input.sampleCount > 0 && input.newestSampleAgeMs > 5 * 60 * 1000) {
    return { score: null, label: t('serverControl.metrics.health.stale'), colorClass: muted, detail: t('serverControl.metrics.health.staleDetail') }
  }
  if (
    input.sampleCount < HEALTH_MIN_SAMPLES ||
    input.hourMedian == null ||
    input.hourAvg == null ||
    input.under30Pct == null ||
    input.longestDipMs == null
  ) {
    return { score: null, label: t('serverControl.metrics.health.calibrating'), colorClass: muted, detail: t('serverControl.metrics.health.calibratingDetail', { count: input.sampleCount, total: HEALTH_MIN_SAMPLES }) }
  }

  const recent = input.recentMedian ?? input.hourMedian
  const components = {
    median: rampScore(HEALTH_FPS_ANCHORS, input.hourMedian),
    recent: rampScore(HEALTH_FPS_ANCHORS, recent),
    avg: rampScore(HEALTH_FPS_ANCHORS, input.hourAvg),
    budget: rampScore(HEALTH_BUDGET_ANCHORS, input.under30Pct),
    dip: rampScore(HEALTH_DIP_ANCHORS, input.longestDipMs),
  }

  const blend =
    components.median * 0.30 +
    components.recent * 0.25 +
    components.avg * 0.15 +
    components.budget * 0.15 +
    components.dip * 0.15

  // Veto caps: [description, cap, tripped]. The tightest tripped cap wins.
  const caps: Array<[string, number, boolean]> = [
    [t('serverControl.metrics.health.caps.min1med10'), 35, input.lastMinuteMedian != null && input.lastMinuteMedian < 10],
    [t('serverControl.metrics.health.caps.min1med15'), 40, input.lastMinuteMedian != null && input.lastMinuteMedian < 15],
    [t('serverControl.metrics.health.caps.min10med25'), 25, recent < 25],
    [t('serverControl.metrics.health.caps.min10med30'), 35, recent < 30],
    [t('serverControl.metrics.health.caps.min10med45'), 65, recent < 45],
    [t('serverControl.metrics.health.caps.hourMed30'), 30, input.hourMedian < 30],
    [t('serverControl.metrics.health.caps.hourMed45'), 60, input.hourMedian < 45],
    [t('serverControl.metrics.health.caps.budget25'), 30, input.under30Pct > 25],
    [t('serverControl.metrics.health.caps.budget10'), 60, input.under30Pct > 10],
    [t('serverControl.metrics.health.caps.dip3m'), 40, input.longestDipMs > 180_000],
    [t('serverControl.metrics.health.caps.dip90s'), 60, input.longestDipMs > 90_000],
  ]
  const active = caps.filter(([, cap, tripped]) => tripped && cap < blend)
  const score = Math.min(blend, ...active.map(([, cap]) => cap))

  const [label, colorClass] =
    score >= 90 ? [t('serverControl.metrics.health.excellent'), 'text-emerald-400'] :
    score >= 75 ? [t('serverControl.metrics.health.good'), 'text-lime-400'] :
    score >= 55 ? [t('serverControl.metrics.health.fair'), 'text-yellow-400'] :
    score >= 35 ? [t('serverControl.metrics.health.degraded'), 'text-orange-400'] :
    [t('serverControl.metrics.health.critical'), 'text-red-500']

  const limiting = active.length > 0
    ? active.map(([name, cap]) => t('serverControl.metrics.health.capEntry', { name, cap })).join(', ')
    : t('serverControl.metrics.health.none')
  const detail = t('serverControl.metrics.health.detail', {
    score: Math.round(score),
    hourMedian: input.hourMedian.toFixed(1),
    medianComp: Math.round(components.median),
    recentMedian: recent.toFixed(1),
    recentComp: Math.round(components.recent),
    avg: input.hourAvg.toFixed(1),
    avgComp: Math.round(components.avg),
    under30: input.under30Pct.toFixed(1),
    budgetComp: Math.round(components.budget),
    longestDip: formatDipDuration(input.longestDipMs),
    dipComp: Math.round(components.dip),
    limiting,
  })

  return { score, label, colorClass, detail }
}

function formatDipDuration(ms: number) {
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}

function getDipDurationColorClass(ms: number | null) {
  if (ms == null) return 'text-foreground'
  if (ms === 0) return 'text-emerald-400'
  if (ms <= 30_000) return 'text-lime-400' // normal sim-burst territory
  if (ms <= 60_000) return 'text-yellow-400'
  if (ms <= 90_000) return 'text-orange-400' // dips are becoming valleys
  return 'text-red-500'
}

function getUnder30BudgetColorClass(pct: number | null) {
  if (pct == null) return 'text-foreground'
  if (pct <= 2) return 'text-emerald-400'
  if (pct <= 5) return 'text-lime-400'
  if (pct <= 10) return 'text-yellow-400'
  if (pct <= 15) return 'text-orange-400' // budget blown past the 10% trip point
  return 'text-red-500'
}

function FpsHistoryGraph({
  samples,
  currentFps,
  pollIntervalMs,
}: {
  samples: { timestamp: number; fps: number }[]
  currentFps: number | null
  pollIntervalMs: number
}) {
  const { t } = useTranslation()
  // Measure the chart area so the SVG viewBox maps 1:1 to CSS pixels —
  // no letterboxing/stretching at any container width.
  const chartAreaRef = React.useRef<HTMLDivElement | null>(null)
  const [chartSize, setChartSize] = React.useState({ width: 640, height: 160 })

  React.useEffect(() => {
    const element = chartAreaRef.current
    if (!element || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver((entries) => {
      const rect = entries[entries.length - 1]?.contentRect
      if (!rect || rect.width <= 0 || rect.height <= 0) return
      setChartSize((previous) =>
        previous.width === rect.width && previous.height === rect.height
          ? previous
          : { width: rect.width, height: rect.height }
      )
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const getFpsTextColorClass = (fps: number | null) => {
    if (fps == null) {
      return 'text-muted-foreground'
    }

    if (fps < 15) return 'text-red-500'
    if (fps < 30) return 'text-orange-400'
    if (fps < 45) return 'text-yellow-400'
    if (fps < 60) return 'text-lime-400'
    return 'text-emerald-400'
  }

  const currentFpsColorClass = getFpsTextColorClass(currentFps)

  const now = Date.now()
  const cutoffTimestamp = now - FPS_HISTORY_WINDOW_MS
  const recentSamples = samples.filter((sample) => Number.isFinite(sample.timestamp) && sample.timestamp >= cutoffTimestamp)
  const chartSamples = recentSamples.length > 0
    ? recentSamples
    : currentFps != null
      ? [{ timestamp: now, fps: currentFps }]
      : []

  const fpsValues = chartSamples.map((sample) => sample.fps)
  const minFps = fpsValues.length > 0 ? Math.min(...fpsValues) : null
  const maxFps = fpsValues.length > 0 ? Math.max(...fpsValues) : null
  const avgFps = fpsValues.length > 0
    ? fpsValues.reduce((sum, value) => sum + value, 0) / fpsValues.length
    : null
  const axisMin = minFps != null ? Math.max(0, Math.floor(minFps - 1)) : 0
  const axisMax = maxFps != null ? Math.ceil(maxFps + 1) : Math.max(Math.ceil((currentFps ?? 0) + 1), 1)
  const axisRange = Math.max(axisMax - axisMin, 1)
  const yAxisLabels = React.useMemo(
    () => Array.from({ length: 5 }, (_, index) => {
      const ratio = 1 - index / 4
      return axisMin + axisRange * ratio
    }),
    [axisMin, axisRange]
  )

  const orderedSamples = React.useMemo(
    () => [...chartSamples].sort((a, b) => a.timestamp - b.timestamp),
    [chartSamples]
  )

  // Health-tile stats (owner order 2026-07-14) — the three watch signals,
  // computed from the same 1h server-side ring the chart renders.
  const medianFps = medianOf(fpsValues)

  // Longest continuous stretch below FPS_DIP_THRESHOLD, gap-aware: a dip
  // cannot chain across a data hole (server/sampler downtime).
  const longestDipMs = (() => {
    if (orderedSamples.length === 0) return null
    let worst = 0
    let runStart: number | null = null
    let previousTimestamp: number | null = null
    for (const sample of orderedSamples) {
      if (previousTimestamp != null && sample.timestamp - previousTimestamp > FPS_GAP_BREAK_MS) {
        runStart = null
      }
      if (sample.fps < FPS_DIP_THRESHOLD) {
        if (runStart == null) runStart = sample.timestamp
        worst = Math.max(worst, sample.timestamp - runStart + FPS_SAMPLE_NOMINAL_MS)
      } else {
        runStart = null
      }
      previousTimestamp = sample.timestamp
    }
    return worst
  })()

  // Share of the visible window spent under 30fps (the burst budget).
  const under30Pct = fpsValues.length > 0
    ? (100 * fpsValues.filter((value) => value < 30).length) / fpsValues.length
    : null

  // General health verdict (owner order 2026-07-14) — rendered beside the live FPS.
  const recentMedianFps = (() => {
    const cutoff = now - HEALTH_RECENT_WINDOW_MS
    const recentFps = orderedSamples
      .filter((sample) => sample.timestamp >= cutoff)
      .map((sample) => sample.fps)
    // Need at least ~1 min of recent data, else fall back to the hour median.
    return recentFps.length >= 12 ? medianOf(recentFps) : null
  })()

  const lastMinuteMedianFps = (() => {
    const cutoff = now - 60_000
    const lastMinuteFps = orderedSamples
      .filter((sample) => sample.timestamp >= cutoff)
      .map((sample) => sample.fps)
    return lastMinuteFps.length >= 6 ? medianOf(lastMinuteFps) : null
  })()

  const health = computeFpsHealth({
    currentFps,
    hourMedian: medianFps,
    recentMedian: recentMedianFps,
    lastMinuteMedian: lastMinuteMedianFps,
    hourAvg: avgFps,
    under30Pct,
    longestDipMs,
    sampleCount: orderedSamples.length,
    newestSampleAgeMs: orderedSamples.length > 0
      ? now - orderedSamples[orderedSamples.length - 1].timestamp
      : Number.POSITIVE_INFINITY,
  }, t)

  // Segments split on real data holes (server/sampler downtime) so the chart
  // never draws an interpolated bridge across a gap in the ring.
  const pointSegments = React.useMemo(() => {
    if (orderedSamples.length === 0) {
      return []
    }

    const { width, height } = chartSize
    // Plot against the FIXED window [now-FPS_HISTORY_WINDOW_MS, now] so the line sits at its
    // true temporal position (right edge = now); the chart shows the real axis even
    // before the buffer fills, instead of stretching whatever data exists to full width.
    const yPadding = height * 0.06

    const toPoint = (sample: { timestamp: number; fps: number }) => {
      const x = ((sample.timestamp - cutoffTimestamp) / FPS_HISTORY_WINDOW_MS) * width
      const normalizedY = (sample.fps - axisMin) / axisRange
      const y = height - normalizedY * height
      return {
        x: Math.min(Math.max(x, 0), width),
        y: Math.min(Math.max(y, yPadding), height - yPadding),
      }
    }

    const segments: Array<Array<{ x: number; y: number }>> = []
    let current: Array<{ x: number; y: number }> = []
    let previousTimestamp: number | null = null

    for (const sample of orderedSamples) {
      if (previousTimestamp != null && sample.timestamp - previousTimestamp > FPS_GAP_BREAK_MS) {
        segments.push(current)
        current = []
      }
      current.push(toPoint(sample))
      previousTimestamp = sample.timestamp
    }
    segments.push(current)

    return segments
  }, [axisMin, axisRange, chartSize, orderedSamples, cutoffTimestamp])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">{t('serverControl.metrics.serverFps')}</p>
          <div className="mt-1 flex items-end gap-2">
            <span className={cn('font-mono text-3xl font-semibold tracking-[0.08em]', currentFpsColorClass)}>
              {currentFps != null ? currentFps.toFixed(1) : t('serverControl.metrics.na')}
            </span>
            <div className="flex flex-col items-start gap-1 pb-1">
              {/* General health verdict (owner order 2026-07-14): blend + veto caps
                  across all ring metrics — hover for the full breakdown. Sits
                  stacked above the LIVE tag, right of the big number (owner
                  placement order 2026-07-14). */}
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-full border border-border/60 bg-secondary/35 px-2.5 py-0.5',
                  health.colorClass
                )}
                title={health.detail}
              >
                <span className="h-2 w-2 rounded-full bg-current" />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em]">{health.label}</span>
              </div>
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">{t('serverControl.metrics.live')}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {t('serverControl.metrics.refreshEvery', { seconds: Math.floor(pollIntervalMs / 1000) })}
          </span>
          <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-[0.2em]">
            {t('serverControl.metrics.hourHistory')}
          </Badge>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
        <div className="flex gap-3">
          <div className="flex h-40 w-11 flex-col justify-between py-1 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {yAxisLabels.map((label, index) => (
              <span key={index}>{label.toFixed(0)}</span>
            ))}
          </div>

          <div
            ref={chartAreaRef}
            className="relative h-40 flex-1 overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-b from-primary/8 via-transparent to-transparent"
          >
            <svg
              viewBox={`0 0 ${chartSize.width} ${chartSize.height}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
            >
              <defs>
                <linearGradient id="fpsLineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
                </linearGradient>
              </defs>

              {Array.from({ length: 11 }, (_, index) => index).map((index) => (
                <line
                  key={`h-${index}`}
                  x1="0"
                  x2={chartSize.width}
                  y1={(index / 10) * chartSize.height}
                  y2={(index / 10) * chartSize.height}
                  className={index % 2 === 0 ? 'stroke-border/45' : 'stroke-border/25'}
                  strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {Array.from({ length: 5 }, (_, index) => index).map((index) => (
                <line
                  key={`v-${index}`}
                  y1="0"
                  y2={chartSize.height}
                  x1={(index / 4) * chartSize.width}
                  x2={(index / 4) * chartSize.width}
                  className="stroke-border/40"
                  strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {pointSegments.map((segment, segmentIndex) =>
                segment.length === 1 ? (
                  // Lone sample after a gap — a one-point polyline is
                  // invisible; render a dot so real data is never hidden.
                  <circle
                    key={`seg-${segmentIndex}`}
                    cx={segment[0].x}
                    cy={segment[0].y}
                    r="1.5"
                    className="text-chart-2"
                    fill="currentColor"
                  />
                ) : (
                  <polyline
                    key={`seg-${segmentIndex}`}
                    fill="none"
                    points={segment.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')}
                    className="text-chart-2 graph-stroke-rounded"
                    stroke="url(#fpsLineGradient)"
                    strokeWidth="1"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )
              )}
            </svg>

            {chartSamples.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
                {t('serverControl.metrics.awaitingSamples')}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i}>{i === 4 ? t('serverControl.metrics.now') : formatAxisAge((FPS_HISTORY_WINDOW_MS * (4 - i)) / 4)}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t('serverControl.metrics.min')}</div>
          <div className={cn('mt-1 font-mono text-sm', getFpsTextColorClass(minFps))}>
            {minFps != null ? minFps.toFixed(1) : t('serverControl.metrics.na')}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t('serverControl.metrics.avg')}</div>
          <div className={cn('mt-1 font-mono text-sm', getFpsTextColorClass(avgFps))}>
            {avgFps != null ? avgFps.toFixed(1) : t('serverControl.metrics.na')}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t('serverControl.metrics.max')}</div>
          <div className={cn('mt-1 font-mono text-sm', getFpsTextColorClass(maxFps))}>
            {maxFps != null ? maxFps.toFixed(1) : t('serverControl.metrics.na')}
          </div>
        </div>
        <div
          className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2"
          title={t('serverControl.metrics.medianTip')}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t('serverControl.metrics.median')}</div>
          <div className={cn('mt-1 font-mono text-sm', getFpsTextColorClass(medianFps))}>
            {medianFps != null ? medianFps.toFixed(1) : t('serverControl.metrics.na')}
          </div>
        </div>
        <div
          className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2"
          title={t('serverControl.metrics.longestDipTip')}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t('serverControl.metrics.longestDip')}</div>
          <div className={cn('mt-1 font-mono text-sm', getDipDurationColorClass(longestDipMs))}>
            {longestDipMs != null ? formatDipDuration(longestDipMs) : t('serverControl.metrics.na')}
          </div>
        </div>
        <div
          className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2"
          title={t('serverControl.metrics.under30Tip')}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t('serverControl.metrics.under30')}</div>
          <div className={cn('mt-1 font-mono text-sm', getUnder30BudgetColorClass(under30Pct))}>
            {under30Pct != null ? `${under30Pct.toFixed(1)}%` : t('serverControl.metrics.na')}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-sm text-foreground">{value}</div>
    </div>
  )
}

export function MetricsCard() {
  // Player count sources from the roster (players.length) — the same truth the
  // roster panel renders — NOT metrics.currentplayernum (owner order 2026-07-10).
  const { serverMetrics, fpsHistory, players, snapshotPollIntervalMs } = useServer()
  const { t } = useTranslation()

  const uptime = serverMetrics
    ? (() => {
        const u = serverMetrics.uptime || 0
        const h = Math.floor(u / 3600)
        const m = Math.floor((u % 3600) / 60)
        return h > 0 ? `${h}h ${m}m` : `${m}m`
      })()
    : t('serverControl.metrics.na')

  return (
    <PanelSection
      title={t('serverControl.metrics.title')}
      subtitle={t('serverControl.metrics.subtitle')}
      status={serverMetrics ? 'active' : 'pending'}
      className="min-h-0"
    >
      <FpsHistoryGraph
        samples={fpsHistory}
        currentFps={serverMetrics?.serverfps ?? null}
        pollIntervalMs={snapshotPollIntervalMs}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <MetricTile
          label={t('serverControl.metrics.frameTime')}
          value={serverMetrics ? `${(serverMetrics.serverframetime ?? 0).toFixed(2)}ms` : t('serverControl.metrics.na')}
        />
        <MetricTile label={t('serverControl.metrics.uptime')} value={uptime} />
        <MetricTile label={t('serverControl.metrics.worldDay')} value={serverMetrics?.days != null ? `${serverMetrics.days}` : t('serverControl.metrics.na')} />
        <MetricTile label={t('serverControl.metrics.bases')} value={serverMetrics?.basecampnum != null ? `${serverMetrics.basecampnum}` : t('serverControl.metrics.na')} />
        <MetricTile
          label={t('serverControl.metrics.players')}
          value={serverMetrics ? `${players.length}/${serverMetrics.maxplayernum}` : `${players.length}`}
        />
      </div>
    </PanelSection>
  )
}

function highlightSearchTerm(text: string, queryLower: string) {
  if (!queryLower) {
    return text
  }

  const textLower = text.toLowerCase()
  const parts: React.ReactNode[] = []
  let cursor = 0

  while (cursor < text.length) {
    const matchIndex = textLower.indexOf(queryLower, cursor)
    if (matchIndex === -1) {
      parts.push(text.slice(cursor))
      break
    }

    if (matchIndex > cursor) {
      parts.push(text.slice(cursor, matchIndex))
    }

    const matchText = text.slice(matchIndex, matchIndex + queryLower.length)
    parts.push(
      <span key={`${matchIndex}-${matchText}`} className="rounded-sm bg-yellow-300 px-0.5 text-yellow-950">
        {matchText}
      </span>
    )
    cursor = matchIndex + queryLower.length
  }

  return parts
}

function ColoredJson({ data, highlightQuery = '' }: { data: Record<string, unknown>; highlightQuery?: string }) {
  const queryLower = highlightQuery.trim().toLowerCase()
  const lines = JSON.stringify(data, null, 2).split('\n')
  const firstMatchLineIndex = React.useMemo(() => {
    if (!queryLower) {
      return -1
    }

    return lines.findIndex((line) => line.toLowerCase().includes(queryLower))
  }, [lines, queryLower])

  return (
    <pre className="text-xs whitespace-pre-wrap font-mono leading-5">
      {lines.map((line, i) => {
        const isFirstMatch = i === firstMatchLineIndex

        // Key
        const keyMatch = line.match(/^(\s*)("(?:[^"\\]|\\.)+")\s*:(.*)$/)
        if (keyMatch) {
          const [, indent, key, rest] = keyMatch
          const valueStr = rest.trim().replace(/,$/, '')
          const comma = rest.trim().endsWith(',') ? ',' : ''
          let valueEl: React.ReactNode

          if (valueStr === 'true' || valueStr === 'false') {
            valueEl = <span className="text-blue-400">{highlightSearchTerm(valueStr, queryLower)}</span>
          } else if (valueStr === 'null') {
            valueEl = <span className="text-muted-foreground">{highlightSearchTerm(valueStr, queryLower)}</span>
          } else if (/^-?\d+(\.\d+)?$/.test(valueStr)) {
            valueEl = <span className="text-amber-400">{highlightSearchTerm(valueStr, queryLower)}</span>
          } else if (valueStr.startsWith('"')) {
            valueEl = <span className="text-green-400">{highlightSearchTerm(valueStr, queryLower)}</span>
          } else {
            valueEl = <span className="text-foreground">{highlightSearchTerm(valueStr, queryLower)}</span>
          }

          return (
            <span key={i} className="block" data-settings-first-match={isFirstMatch ? 'true' : undefined}>
              {indent}<span className="text-chart-1">{highlightSearchTerm(key, queryLower)}</span>
              {': '}{valueEl}{comma}
            </span>
          )
        }
        // Braces / brackets / plain lines
        return (
          <span
            key={i}
            className="block text-muted-foreground"
            data-settings-first-match={isFirstMatch ? 'true' : undefined}
          >
            {highlightSearchTerm(line, queryLower)}
          </span>
        )
      })}
    </pre>
  )
}

export function SettingsCard() {
  const { settings, serverInfo } = useServer()
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const jsonContainerRef = useRef<HTMLDivElement | null>(null)
  const normalizedQuery = searchQuery.trim().toLowerCase()
  const hasSearchResults = React.useMemo(() => {
    if (!settings || !normalizedQuery) {
      return true
    }

    return JSON.stringify(settings).toLowerCase().includes(normalizedQuery)
  }, [settings, normalizedQuery])

  useEffect(() => {
    if (!settings || !normalizedQuery) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const container = jsonContainerRef.current
      const firstMatch = container?.querySelector('[data-settings-first-match="true"]') as HTMLElement | null
      if (!container || !firstMatch) return

      // Scroll only the JSON container, never the page.
      const containerRect = container.getBoundingClientRect()
      const matchRect = firstMatch.getBoundingClientRect()
      const targetScrollTop =
        container.scrollTop +
        (matchRect.top - containerRect.top) -
        container.clientHeight / 2 +
        firstMatch.clientHeight / 2

      container.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: 'smooth',
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [settings, normalizedQuery])

  return (
    <PanelSection
      title={t('serverControl.settings.title')}
      subtitle={t('serverControl.settings.subtitle')}
      status={settings ? 'complete' : 'active'}
      contentClassName="flex min-h-0 flex-1 flex-col"
    >
        <div className="space-y-2">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t('serverControl.settings.description')}</div>
            <div className="mt-0.5 break-words font-mono text-sm text-foreground">
              {serverInfo?.description || t('serverControl.settings.noDescription')}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t('serverControl.settings.worldGuid')}</div>
            <div className="mt-0.5 break-all font-mono text-sm text-foreground">
              {serverInfo?.worldguid ?? t('serverControl.settings.unknown')}
            </div>
          </div>
        </div>
        {settings && (
          <div className="space-y-1.5">
            <FieldLabel htmlFor="settings-search">{t('serverControl.settings.search')}</FieldLabel>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white" />
              <Input
                id="settings-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('serverControl.settings.searchPlaceholder')}
                className="h-8 pl-9 text-xs"
              />
            </div>
          </div>
        )}
        {settings && (
          <div
            ref={jsonContainerRef}
            className="settings-json-scroll max-h-[165px] overflow-auto rounded-lg bg-secondary/50 p-3"
            style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
          >
            {!hasSearchResults && normalizedQuery && (
              <p className="py-6 text-center text-xs text-muted-foreground">{t('serverControl.settings.noResults')}</p>
            )}
            <ColoredJson data={settings} highlightQuery={searchQuery} />
          </div>
        )}
    </PanelSection>
  )
}
