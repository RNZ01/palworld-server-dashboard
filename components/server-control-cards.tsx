'use client'

import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { DataCard } from '@/components/data-card'
import { InfoPanel } from '@/components/status-bar'
import { useServer } from '@/lib/server-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
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
  ServerIcon,
  UsersIcon,
  MegaphoneIcon,
  SaveIcon,
  PowerIcon,
  StopCircleIcon,
  ShieldIcon,
  ActivityIcon,
  SettingsIcon,
  SearchIcon
} from 'lucide-react'

const FPS_HISTORY_WINDOW_MS = 30 * 60 * 1000

function PanelSection({
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

export function ServerInfoCard() {
  const { serverInfo } = useServer()

  return (
    <DataCard
      title="Server Info"
      subtitle="Intel Feed"
      status={serverInfo ? 'active' : 'inactive'}
      fields={[
        { label: 'Name', value: serverInfo?.servername ?? 'Unavailable', highlight: true },
        { label: 'Version', value: serverInfo?.version ?? 'N/A' },
        { label: 'Description', value: serverInfo?.description || 'No description' },
        { label: 'World GUID', value: serverInfo?.worldguid ?? 'Unknown' },
      ]}
      className="h-full"
    />
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

const PRESET_MESSAGES: PresetMessage[] = [
  {
    label: '⚠ Restart in 1 min',
    message: '⚠ Server will restart in 1 minute. Please find a safe spot!',
    tone: 'warning',
    reminders: [
      { delayMs: 30_000, message: '⚠ Server restarting in 30 seconds!' },
      { delayMs: 50_000, message: '⚠ Server restarting in 10 seconds!' },
    ],
  },
  {
    label: '⚠ Restart in 5 min',
    message: '⚠ Server will restart in 5 minutes.',
    tone: 'warning',
    reminders: [
      { delayMs:  60_000, message: '⚠ Server restarting in 4 minutes.' },
      { delayMs: 120_000, message: '⚠ Server restarting in 3 minutes.' },
      { delayMs: 180_000, message: '⚠ Server restarting in 2 minutes.' },
      { delayMs: 240_000, message: '⚠ Server restarting in 1 minute!' },
      { delayMs: 270_000, message: '⚠ Server restarting in 30 seconds!' },
      { delayMs: 290_000, message: '⚠ Server restarting in 10 seconds!' },
    ],
  },
  {
    label: '⚠ Restart in 10 min',
    message: '⚠ Server will restart in 10 minutes.',
    tone: 'warning',
    reminders: [
      { delayMs: 300_000, message: '⚠ Server restarting in 5 minutes.' },
      { delayMs: 480_000, message: '⚠ Server restarting in 2 minutes!' },
      { delayMs: 540_000, message: '⚠ Server restarting in 1 minute!' },
      { delayMs: 570_000, message: '⚠ Server restarting in 30 seconds!' },
      { delayMs: 590_000, message: '⚠ Server restarting in 10 seconds!' },
    ],
  },
  { label: 'Maintenance soon', message: 'Maintenance starting soon. Server will go offline briefly.', tone: 'warning' },
  { label: 'Save complete',    message: 'World has been saved successfully.', tone: 'success' },
  { label: 'Admin online',     message: 'An admin is online. Play fair!', tone: 'info' },
  { label: 'Restart complete', message: '✅ Server restart complete. Welcome back!', tone: 'success' },
  { label: 'Backup running', message: '💾 Backup is now running. Temporary lag may occur.', tone: 'warning' },
  { label: 'Backup complete', message: '✅ Backup complete. Thank you for your patience.', tone: 'success' },
  { label: 'Prepare to save', message: 'Saving world in 60 seconds. Please avoid risky actions.', tone: 'warning' },
  { label: 'PvP event soon', message: '⚔ PvP event starts in 5 minutes. Gear up and meet at base!', tone: 'info' },
  { label: 'Server full soon', message: 'Server population is high. Slots may fill up soon.', tone: 'warning' },
  { label: 'High latency', message: '⚠ High latency detected. We are monitoring server performance.', tone: 'warning' },
  { label: 'Rules reminder', message: 'Reminder: Keep chat respectful and avoid griefing.', tone: 'info' },
  { label: 'Admin maintenance', message: 'Admin tools maintenance in progress. Some actions may be delayed.', tone: 'warning' },
]
const RESTART_PRESET_MESSAGES = PRESET_MESSAGES.filter((preset) => Array.isArray(preset.reminders))
const GENERAL_PRESET_MESSAGES = PRESET_MESSAGES.filter((preset) => !preset.reminders)

export function AnnouncementCard() {
  const { apiCall, isLoading } = useServer()
  const [message, setMessage] = useState('')

  const sendMessage = async (text: string) => {
    await apiCall('announce', 'POST', { message: text })
  }

  const sendAnnouncement = async (preset?: PresetMessage) => {
    const text = preset ? preset.message : message
    if (!text.trim()) {
      toast.error('Please enter a message')
      return
    }
    try {
      await sendMessage(text)
      toast.success('Announcement sent')
      if (!preset) setMessage('')
    } catch {
      toast.error('Failed to send announcement')
    }
  }

  return (
    <PanelSection title="Announcements" subtitle="Broadcast Channel" status="active">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Quick Messages</p>
          <div className="flex flex-wrap gap-1.5">
            {GENERAL_PRESET_MESSAGES.map((preset) => (
              <Button
                key={preset.label}
                onClick={() => setMessage(preset.message)}
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-auto whitespace-normal px-2 py-1 text-left text-xs",
                  getQuickMessageToneClass(preset)
                )}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="announcement">Message</FieldLabel>
            <Textarea
              id="announcement"
              placeholder="Enter your announcement..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="bg-input border-border resize-none"
              rows={3}
            />
          </Field>
        </FieldGroup>
        <Button
          onClick={() => sendAnnouncement()}
          disabled={isLoading['announce']}
          className="w-full bg-chart-2 text-background hover:bg-chart-2/90"
        >
          {isLoading['announce'] ? <Spinner className="w-4 h-4 mr-2" /> : <MegaphoneIcon className="w-4 h-4 mr-2" />}
          Send Announcement
        </Button>
    </PanelSection>
  )
}

export function ServerManagementCard() {
  const { apiCall, isLoading } = useServer()
  const [confirmAction, setConfirmAction] = useState<'shutdown' | 'stop' | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeSchedule, setActiveSchedule] = useState<{ label: string; endsAt: number } | null>(null)
  const [remaining, setRemaining] = useState(0)
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([])

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

  const sendRestartMessage = async (text: string) => {
    await apiCall('announce', 'POST', { message: text })
  }

  const executeScheduledRestartShutdown = async () => {
    try {
      await apiCall('save', 'POST')
      await sendRestartMessage('World has been saved successfully.')
      toast.success('World saved before shutdown')

      await apiCall('shutdown', 'POST', { waittime: 1 })
      toast.success('Server shutdown initiated')
    } catch {
      toast.error('Failed to shutdown server')
    }
  }

  const scheduleRestart = async (preset: PresetMessage) => {
    if (!preset.reminders?.length) return

    try {
      await sendRestartMessage(preset.message)
      toast.success('Announcement sent')

      clearScheduleTimers()

      const lastReminderMs = preset.reminders[preset.reminders.length - 1].delayMs
      const shutdownDelayMs = lastReminderMs + 10_000
      setActiveSchedule({ label: preset.label, endsAt: Date.now() + shutdownDelayMs })
      setRemaining(shutdownDelayMs)

      const refs = preset.reminders.map(({ delayMs, message: reminderMsg }) =>
        setTimeout(async () => {
          try {
            await sendRestartMessage(reminderMsg)
          } catch {}
          toast.info(reminderMsg, { duration: 4000 })
        }, delayMs)
      )

      const shutdownTimer = setTimeout(async () => {
        await executeScheduledRestartShutdown()
        clearScheduleTimers()
      }, shutdownDelayMs)

      timerRefs.current = [...refs, shutdownTimer]
    } catch {
      toast.error('Failed to send announcement')
    }
  }

  const cancelRestartSchedule = async () => {
    clearScheduleTimers()
    try {
      await sendRestartMessage('✅ Server restart has been cancelled.')
      toast.success('Restart cancelled — players notified.')
    } catch {
      toast.info('Schedule cancelled (announcement failed).')
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
      await announceSilently('World has been saved successfully.')
      toast.success('World saved successfully')
      return true
    } catch {
      toast.error('Failed to save world')
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
      await announceSilently('⚠ Server will shutdown in 10 seconds!')
      toast.info('Shutdown announced - waiting 10 seconds...')
      
      // Wait 10 seconds then shutdown
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      await apiCall('shutdown', 'POST', { waittime: 1 })
      toast.success('Server shutdown initiated')
    } catch {
      toast.error('Failed to shutdown server')
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
      await announceSilently('⚠ Server force stopping now!')
      
      await apiCall('stop', 'POST')
      toast.success('Server stopped')
    } catch {
      toast.error('Failed to stop server')
    }
    setIsProcessing(false)
    setConfirmAction(null)
  }

    return (
      <>
      <PanelSection
        title="Server Management"
        subtitle="Command Deck"
        status={isProcessing || activeSchedule ? 'pending' : 'active'}
        contentClassName="mt-0 flex flex-1 flex-col gap-3"
      >
          {activeSchedule && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="status-dot h-2 w-2 shrink-0 animate-pulse rounded-full bg-warning" />
                <span className="text-warning font-medium">{activeSchedule.label}</span>
                <span className="text-muted-foreground">
                  — next reminder in <span className="font-mono font-semibold text-foreground">{formatRemaining(remaining)}</span>
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                onClick={cancelRestartSchedule}
              >
                Cancel
              </Button>
            </div>
          )}

          <div className="space-y-1.5 rounded-lg border border-amber-500/25 bg-amber-500/5 p-2.5">
            <p className="text-[11px] font-semibold text-amber-300">Restart Schedules</p>
            <p className="text-[10px] leading-relaxed text-amber-200/85">
              Note: Triggering a restart schedule takes effect immediately and restarts the server after the selected
              delay. If the Docker restart policy is not set to <span className="font-mono">always</span> or{' '}
              <span className="font-mono">unless-stopped</span>, you'll need to start it manually afterward.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {RESTART_PRESET_MESSAGES.map((preset) => (
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

          <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
          <Button
            onClick={saveWorld}
            disabled={isLoading['save'] || isProcessing}
            variant="outline"
            className="w-full !border-emerald-500/60 !bg-emerald-500/12 !text-emerald-200 hover:!bg-emerald-500/22 hover:!text-emerald-100"
          >
            {isLoading['save'] ? <Spinner className="w-4 h-4 mr-2" /> : <SaveIcon className="w-4 h-4 mr-2" />}
            Save World
          </Button>
          <Button
            onClick={() => setConfirmAction('shutdown')}
            disabled={isProcessing}
            variant="outline"
            className="w-full !border-amber-500/60 !bg-amber-500/12 !text-amber-200 hover:!bg-amber-500/22 hover:!text-amber-100"
          >
            <PowerIcon className="w-4 h-4 mr-2" />
            Shutdown Server
          </Button>
          <Button
            onClick={() => setConfirmAction('stop')}
            disabled={isProcessing}
            variant="outline"
            className="w-full !border-red-500/65 !bg-red-500/14 !text-red-200 hover:!bg-red-500/24 hover:!text-red-100"
          >
            <StopCircleIcon className="w-4 h-4 mr-2" />
            Force Stop
          </Button>
          </div>
      </PanelSection>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !isProcessing && !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'shutdown' ? 'Shutdown Server' : 'Force Stop Server'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'shutdown'
                ? 'This will save the world, announce shutdown, wait 10 seconds, then shutdown the server.'
                : 'This will save the world, announce the stop, then immediately stop the server.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction === 'shutdown' ? shutdownServer : stopServer}
              disabled={isProcessing}
              className={confirmAction === 'stop' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-warning text-warning-foreground hover:bg-warning/90'}
            >
              {isProcessing ? <Spinner className="w-4 h-4 mr-2" /> : null}
              {confirmAction === 'shutdown' ? (isProcessing ? 'Shutting down...' : 'Shutdown') : (isProcessing ? 'Stopping...' : 'Force Stop')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function BanManagementCard() {
  const { apiCall, isLoading, bannedPlayers, removeBannedPlayer } = useServer()

  const handleUnban = async (steamId: string) => {
    try {
      await apiCall('unban', 'POST', { userid: steamId })
      removeBannedPlayer(steamId)
      toast.success(`Player unbanned`)
    } catch {
      toast.error('Failed to unban player')
    }
  }

  return (
    <PanelSection title="Ban Management" subtitle="Sanctions Ledger" status={bannedPlayers.length > 0 ? 'pending' : 'active'}>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Banned Players ({bannedPlayers.length})</p>
          {bannedPlayers.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">No banned players 🎉</p>
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
                    {isLoading['unban'] ? <Spinner className="w-3 h-3" /> : 'Unban'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
    </PanelSection>
  )
}

function FpsHistoryGraph({
  samples,
  currentFps,
}: {
  samples: { timestamp: number; fps: number }[]
  currentFps: number | null
}) {
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

  const pointString = React.useMemo(() => {
    if (chartSamples.length === 0) {
      return ''
    }

    const orderedSamples = [...chartSamples].sort((a, b) => a.timestamp - b.timestamp)
    const firstTimestamp = orderedSamples[0]?.timestamp ?? 0
    const lastTimestamp = orderedSamples[orderedSamples.length - 1]?.timestamp ?? firstTimestamp
    const timestampSpan = Math.max(lastTimestamp - firstTimestamp, 1)

    return orderedSamples
      .map((sample) => {
        const x = orderedSamples.length === 1
          ? 50
          : ((sample.timestamp - firstTimestamp) / timestampSpan) * 100
        const normalizedY = (sample.fps - axisMin) / axisRange
        const y = 100 - normalizedY * 100
        return `${Math.min(Math.max(x, 0), 100)},${Math.min(Math.max(y, 6), 94)}`
      })
      .join(' ')
  }, [axisMin, axisRange, chartSamples])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Server FPS</p>
          <div className="mt-1 flex items-end gap-2">
            <span className={cn('font-mono text-3xl font-semibold tracking-[0.08em]', currentFpsColorClass)}>
              {currentFps != null ? currentFps.toFixed(1) : 'N/A'}
            </span>
            <span className="pb-1 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Live</span>
          </div>
        </div>
        <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-[0.2em]">
          30 Minute History
        </Badge>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
        <div className="flex gap-3">
          <div className="flex h-40 w-11 flex-col justify-between py-1 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {yAxisLabels.map((label, index) => (
              <span key={index}>{label.toFixed(0)}</span>
            ))}
          </div>

          <div className="relative h-40 flex-1 overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-b from-primary/8 via-transparent to-transparent">
            <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
              <defs>
                <linearGradient id="fpsLineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="1" />
                </linearGradient>
              </defs>

              {Array.from({ length: 11 }, (_, index) => index * 10).map((line) => (
                <line
                  key={`h-${line}`}
                  x1="0"
                  x2="100"
                  y1={line}
                  y2={line}
                  className={line % 20 === 0 ? 'stroke-border/45' : 'stroke-border/25'}
                  strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {Array.from({ length: 11 }, (_, index) => index * 10).map((line) => (
                <line
                  key={`v-${line}`}
                  y1="0"
                  y2="100"
                  x1={line}
                  x2={line}
                  className={line % 20 === 0 ? 'stroke-border/40' : 'stroke-border/20'}
                  strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {pointString && (
                <polyline
                  fill="none"
                  points={pointString}
                  className="text-chart-2 graph-stroke-rounded"
                  stroke="url(#fpsLineGradient)"
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>

            {chartSamples.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Awaiting Metrics Samples
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          <span>-30m</span>
          <span>-15m</span>
          <span>Now</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Min</div>
          <div className={cn('mt-1 font-mono text-sm', getFpsTextColorClass(minFps))}>
            {minFps != null ? minFps.toFixed(1) : 'N/A'}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Avg</div>
          <div className={cn('mt-1 font-mono text-sm', getFpsTextColorClass(avgFps))}>
            {avgFps != null ? avgFps.toFixed(1) : 'N/A'}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Max</div>
          <div className={cn('mt-1 font-mono text-sm', getFpsTextColorClass(maxFps))}>
            {maxFps != null ? maxFps.toFixed(1) : 'N/A'}
          </div>
        </div>
      </div>
    </div>
  )
}

export function MetricsCard() {
  const { serverMetrics, fpsHistory, nextMetricsFetchAt, metricsPollIntervalMs } = useServer()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    setNow(Date.now())

    if (!nextMetricsFetchAt) {
      return
    }

    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 500)

    return () => window.clearInterval(interval)
  }, [nextMetricsFetchAt])

  const nextFetchRemainingMs = nextMetricsFetchAt != null
    ? Math.max(0, nextMetricsFetchAt - now)
    : null

  const formatCountdown = (ms: number) => {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <PanelSection
      title="Metrics"
      subtitle="Live Performance"
      status={serverMetrics ? 'active' : 'pending'}
      className="min-h-[22rem]"
    >
      <div className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Next Metrics Fetch</div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="font-mono text-sm text-primary">
            {nextFetchRemainingMs != null ? formatCountdown(nextFetchRemainingMs) : 'N/A'}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Every {Math.floor(metricsPollIntervalMs / 1000)}s
          </span>
        </div>
      </div>

      <FpsHistoryGraph samples={fpsHistory} currentFps={serverMetrics?.serverfps ?? null} />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Players</div>
          <div className="mt-1 font-mono text-sm text-foreground">
            {serverMetrics ? `${serverMetrics.currentplayernum}/${serverMetrics.maxplayernum}` : 'N/A'}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Frame Time</div>
          <div className="mt-1 font-mono text-sm text-foreground">
            {serverMetrics ? `${Math.floor(serverMetrics.serverframetime ?? 0)}ms` : 'N/A'}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Uptime</div>
          <div className="mt-1 font-mono text-sm text-foreground">
            {serverMetrics
              ? (() => {
                  const u = serverMetrics.uptime || 0
                  const h = Math.floor(u / 3600)
                  const m = Math.floor((u % 3600) / 60)
                  return h > 0 ? `${h}h ${m}m` : `${m}m`
                })()
              : 'N/A'}
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">World Day</div>
          <div className="mt-1 font-mono text-sm text-foreground">
            {serverMetrics?.days != null ? `${serverMetrics.days}` : 'N/A'}
          </div>
        </div>
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
  const { settings } = useServer()
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
      title="Settings"
      subtitle="Configuration Snapshot"
      status={settings ? 'complete' : 'active'}
      contentClassName="flex min-h-0 flex-1 flex-col"
    >
        {settings && (
          <div className="space-y-1.5">
            <FieldLabel htmlFor="settings-search">Search Settings</FieldLabel>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white" />
              <Input
                id="settings-search"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by key or value..."
                className="h-8 pl-9 text-xs"
              />
            </div>
          </div>
        )}
        {settings && (
          <div
            ref={jsonContainerRef}
            className="settings-json-scroll max-h-[400px] overflow-auto rounded-lg bg-secondary/50 p-3"
            style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
          >
            {!hasSearchResults && normalizedQuery && (
              <p className="py-6 text-center text-xs text-muted-foreground">No settings matched your search.</p>
            )}
            <ColoredJson data={settings} highlightQuery={searchQuery} />
          </div>
        )}
    </PanelSection>
  )
}
