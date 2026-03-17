'use client'

import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { DataCard } from '@/components/data-card'
import { InfoPanel } from '@/components/status-bar'
import { useServer } from '@/lib/server-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  SettingsIcon
} from 'lucide-react'

const FPS_HISTORY_WINDOW_MS = 60 * 60 * 1000

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
}

const PRESET_MESSAGES: PresetMessage[] = [
  {
    label: '⚠ Restart in 1 min',
    message: '⚠ Server will restart in 1 minute. Please find a safe spot!',
    reminders: [
      { delayMs: 30_000, message: '⚠ Server restarting in 30 seconds!' },
      { delayMs: 50_000, message: '⚠ Server restarting in 10 seconds!' },
    ],
  },
  {
    label: '⚠ Restart in 5 min',
    message: '⚠ Server will restart in 5 minutes.',
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
    reminders: [
      { delayMs: 300_000, message: '⚠ Server restarting in 5 minutes.' },
      { delayMs: 480_000, message: '⚠ Server restarting in 2 minutes!' },
      { delayMs: 540_000, message: '⚠ Server restarting in 1 minute!' },
      { delayMs: 570_000, message: '⚠ Server restarting in 30 seconds!' },
      { delayMs: 590_000, message: '⚠ Server restarting in 10 seconds!' },
    ],
  },
  { label: 'Maintenance soon', message: 'Maintenance starting soon. Server will go offline briefly.' },
  { label: 'Save complete',    message: 'World has been saved successfully.' },
  { label: 'Admin online',     message: 'An admin is online. Play fair!' },
]

export function AnnouncementCard() {
  const { apiCall, isLoading } = useServer()
  const [message, setMessage] = useState('')
  const [activeSchedule, setActiveSchedule] = useState<{ label: string; endsAt: number } | null>(null)
  const [remaining, setRemaining] = useState(0)
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([])

  // Countdown tick
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

  // Clear timers without announcing (used when starting a new schedule)
  const clearTimers = () => {
    timerRefs.current.forEach(clearTimeout)
    timerRefs.current = []
    setActiveSchedule(null)
  }

  // Cancel with announcement (user clicked cancel button)
  const cancelSchedule = async () => {
    clearTimers()
    try {
      await sendMessage('✅ Server restart has been cancelled.')
      toast.success('Restart cancelled — players notified.')
    } catch {
      toast.info('Schedule cancelled (announcement failed).')
    }
  }

  const sendMessage = async (text: string) => {
    await apiCall('announce', 'POST', { message: text })
  }

  const executeShutdown = async () => {
    try {
      // Save world first
      await apiCall('save', 'POST')
      await sendMessage('World has been saved successfully.')
      toast.success('World saved before shutdown')
      
      // Execute shutdown
      await apiCall('shutdown', 'POST', { waittime: 1 })
      toast.success('Server shutdown initiated')
    } catch {
      toast.error('Failed to shutdown server')
    }
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

      if (preset?.reminders?.length) {
        // Clear any existing timers without announcing cancellation
        clearTimers()
        // Find total duration from last reminder + 10 seconds for shutdown
        const lastReminderMs = preset.reminders[preset.reminders.length - 1].delayMs
        const shutdownDelayMs = lastReminderMs + 10_000 // 10 seconds after last reminder
        setActiveSchedule({ label: preset.label, endsAt: Date.now() + shutdownDelayMs })
        setRemaining(shutdownDelayMs)
        
        // Schedule all reminder messages
        const refs = preset.reminders.map(({ delayMs, message: reminderMsg }) =>
          setTimeout(async () => {
            try { await sendMessage(reminderMsg) } catch {}
            toast.info(reminderMsg, { duration: 4000 })
          }, delayMs)
        )
        
        // Schedule the actual shutdown after the last reminder
        const shutdownTimer = setTimeout(async () => {
          await executeShutdown()
          clearTimers()
        }, shutdownDelayMs)
        
        timerRefs.current = [...refs, shutdownTimer]
      }
    } catch {
      toast.error('Failed to send announcement')
    }
  }

  const formatRemaining = (ms: number) => {
    const s = Math.ceil(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`
  }

  return (
    <PanelSection title="Announcements" subtitle="Broadcast Channel" status={activeSchedule ? 'pending' : 'active'}>
        {activeSchedule && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-warning animate-pulse shrink-0" />
              <span className="text-warning font-medium">{activeSchedule.label}</span>
              <span className="text-muted-foreground">— next reminder in <span className="font-mono font-semibold text-foreground">{formatRemaining(remaining)}</span></span>
            </div>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={cancelSchedule}>
              Cancel
            </Button>
          </div>
        )}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Quick Messages</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_MESSAGES.map((preset) => (
              <Button
                key={preset.label}
                onClick={() => preset.reminders ? sendAnnouncement(preset) : setMessage(preset.message)}
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

  const sendAnnouncement = async (text: string) => {
    try {
      await apiCall('announce', 'POST', { message: text })
    } catch {
      // Silently fail announcement
    }
  }

  const saveWorldAndAnnounce = async (): Promise<boolean> => {
    try {
      await apiCall('save', 'POST')
      await sendAnnouncement('World has been saved successfully.')
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
      await sendAnnouncement('⚠ Server will shutdown in 10 seconds!')
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
      await sendAnnouncement('⚠ Server force stopping now!')
      
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
        status={isProcessing ? 'pending' : 'active'}
        contentClassName="mt-0 flex flex-1 flex-col justify-center space-y-0"
      >
          <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
          <Button
            onClick={saveWorld}
            disabled={isLoading['save'] || isProcessing}
            variant="secondary"
            className="w-full"
          >
            {isLoading['save'] ? <Spinner className="w-4 h-4 mr-2" /> : <SaveIcon className="w-4 h-4 mr-2" />}
            Save World
          </Button>
          <Button
            onClick={() => setConfirmAction('shutdown')}
            disabled={isProcessing}
            variant="outline"
            className="w-full border-warning/50 text-warning hover:bg-warning/10"
          >
            <PowerIcon className="w-4 h-4 mr-2" />
            Shutdown Server
          </Button>
          <Button
            onClick={() => setConfirmAction('stop')}
            disabled={isProcessing}
            variant="outline"
            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
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
            <p className="text-xs text-muted-foreground text-center py-3">No banned players</p>
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
  const now = Date.now()
  const chartSamples = samples.length > 0
    ? samples
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

    const chartFloor = now - FPS_HISTORY_WINDOW_MS

    return chartSamples
      .map((sample) => {
        const x = ((sample.timestamp - chartFloor) / FPS_HISTORY_WINDOW_MS) * 100
        const normalizedY = (sample.fps - axisMin) / axisRange
        const y = 100 - normalizedY * 100
        return `${Math.min(Math.max(x, 0), 100)},${Math.min(Math.max(y, 6), 94)}`
      })
      .join(' ')
  }, [axisMin, axisRange, chartSamples, now])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Server FPS</p>
          <div className="mt-1 flex items-end gap-2">
            <span className="font-mono text-3xl font-semibold tracking-[0.08em] text-primary">
              {currentFps != null ? currentFps.toFixed(1) : 'N/A'}
            </span>
            <span className="pb-1 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">Live</span>
          </div>
        </div>
        <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-[0.2em]">
          1 Hour History
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

              {[20, 40, 60, 80].map((line) => (
                <line
                  key={line}
                  x1="0"
                  x2="100"
                  y1={line}
                  y2={line}
                  className="stroke-border/40"
                  strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {[25, 50, 75].map((line) => (
                <line
                  key={line}
                  y1="0"
                  y2="100"
                  x1={line}
                  x2={line}
                  className="stroke-border/30"
                  strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {pointString && (
                <polyline
                  fill="none"
                  points={pointString}
                  className="text-chart-2"
                  stroke="url(#fpsLineGradient)"
                  strokeWidth="2"
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
          <span>-60m</span>
          <span>-30m</span>
          <span>Now</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Min</div>
          <div className="mt-1 font-mono text-sm text-foreground">{minFps != null ? minFps.toFixed(1) : 'N/A'}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Avg</div>
          <div className="mt-1 font-mono text-sm text-foreground">{avgFps != null ? avgFps.toFixed(1) : 'N/A'}</div>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/35 px-3 py-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Max</div>
          <div className="mt-1 font-mono text-sm text-foreground">{maxFps != null ? maxFps.toFixed(1) : 'N/A'}</div>
        </div>
      </div>
    </div>
  )
}

export function MetricsCard() {
  const { serverMetrics, fpsHistory } = useServer()

  return (
    <PanelSection
      title="Metrics"
      subtitle="Live Performance"
      status={serverMetrics ? 'active' : 'pending'}
      className="min-h-[22rem]"
    >
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

function ColoredJson({ data }: { data: Record<string, unknown> }) {
  const lines = JSON.stringify(data, null, 2).split('\n')
  return (
    <pre className="text-xs whitespace-pre-wrap font-mono leading-5">
      {lines.map((line, i) => {
        // Key
        const keyMatch = line.match(/^(\s*)("[\w\s]+")\s*:(.*)$/)
        if (keyMatch) {
          const [, indent, key, rest] = keyMatch
          const valueStr = rest.trim().replace(/,$/, '')
          const comma = rest.trim().endsWith(',') ? ',' : ''
          let valueEl: React.ReactNode

          if (valueStr === 'true' || valueStr === 'false') {
            valueEl = <span className="text-blue-400">{valueStr}</span>
          } else if (valueStr === 'null') {
            valueEl = <span className="text-muted-foreground">{valueStr}</span>
          } else if (/^-?\d+(\.\d+)?$/.test(valueStr)) {
            valueEl = <span className="text-amber-400">{valueStr}</span>
          } else if (valueStr.startsWith('"')) {
            valueEl = <span className="text-green-400">{valueStr}</span>
          } else {
            valueEl = <span className="text-foreground">{valueStr}</span>
          }

          return (
            <span key={i}>
              {indent}<span className="text-chart-1">{key}</span>
              {': '}{valueEl}{comma}{'\n'}
            </span>
          )
        }
        // Braces / brackets / plain lines
        return (
          <span key={i} className="text-muted-foreground">{line}{'\n'}</span>
        )
      })}
    </pre>
  )
}

export function SettingsCard() {
  const { settings } = useServer()

  return (
    <PanelSection
      title="Settings"
      subtitle="Configuration Snapshot"
      status={settings ? 'complete' : 'active'}
      contentClassName="flex min-h-0 flex-col"
    >
        {settings && (
          <div
            className="settings-json-scroll max-h-[400px] overflow-auto rounded-lg bg-secondary/50 p-3"
            style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
          >
            <ColoredJson data={settings} />
          </div>
        )}
    </PanelSection>
  )
}
