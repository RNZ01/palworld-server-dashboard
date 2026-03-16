'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useServer } from '@/lib/server-context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

export function ServerInfoCard() {
  const { serverInfo } = useServer()

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ServerIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-foreground">Server Info</CardTitle>
            <CardDescription>View server information</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {serverInfo && (
          <div className="p-3 rounded-lg bg-secondary/50 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">Name:</span>
              <span className="text-foreground font-medium text-right truncate">{serverInfo.servername}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">Version:</span>
              <span className="text-foreground font-medium">{serverInfo.version}</span>
            </div>
            {serverInfo.description && (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground shrink-0">Description:</span>
                <span className="text-foreground font-medium text-right truncate max-w-[200px]">{serverInfo.description}</span>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground shrink-0">World GUID:</span>
              <span className="text-foreground font-medium font-mono text-xs truncate max-w-[190px]">{serverInfo.worldguid}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
            <MegaphoneIcon className="w-5 h-5 text-chart-4" />
          </div>
          <div>
            <CardTitle className="text-foreground">Announcements</CardTitle>
            <CardDescription>Broadcast messages to players</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
              <button
                key={preset.label}
                onClick={() => preset.reminders ? sendAnnouncement(preset) : setMessage(preset.message)}
                className="text-xs px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border transition-colors text-left"
              >
                {preset.label}
              </button>
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
          className="w-full bg-chart-4 text-chart-4-foreground hover:bg-chart-4/90"
        >
          {isLoading['announce'] ? <Spinner className="w-4 h-4 mr-2" /> : <MegaphoneIcon className="w-4 h-4 mr-2" />}
          Send Announcement
        </Button>
      </CardContent>
    </Card>
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
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-chart-3" />
            </div>
            <div>
              <CardTitle className="text-foreground">Server Management</CardTitle>
              <CardDescription>Control server operations</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
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
        </CardContent>
      </Card>

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
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <ShieldIcon className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-foreground">Ban Management</CardTitle>
            <CardDescription>Manage player bans</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  )
}

export function MetricsCard() {
  const { serverMetrics } = useServer()

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <ActivityIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-foreground">Metrics</CardTitle>
            <CardDescription>View server performance</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {serverMetrics && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground">Server FPS</p>
              <p className="text-lg font-semibold text-foreground">{serverMetrics.serverfps}</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground">Players</p>
              <p className="text-lg font-semibold text-foreground">{serverMetrics.currentplayernum}/{serverMetrics.maxplayernum}</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground">Frame Time</p>
              <p className="text-lg font-semibold text-foreground">{Math.floor(serverMetrics.serverframetime ?? 0)}ms</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground">Uptime</p>
              <p className="text-lg font-semibold text-foreground">
                {(() => {
                  const u = serverMetrics.uptime || 0
                  const h = Math.floor(u / 3600)
                  const m = Math.floor((u % 3600) / 60)
                  return h > 0 ? `${h}h ${m}m` : `${m}m`
                })()}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground">In-Game Days</p>
              <p className="text-lg font-semibold text-foreground">{serverMetrics.days ?? '—'}</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground">Base Camps</p>
              <p className="text-lg font-semibold text-foreground">{serverMetrics.basecampnum ?? '—'}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-chart-2" />
          </div>
          <div>
            <CardTitle className="text-foreground">Settings</CardTitle>
            <CardDescription>View server settings</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {settings && (
          <div className="p-3 rounded-lg bg-secondary/50 max-h-64 overflow-auto">
            <ColoredJson data={settings} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
