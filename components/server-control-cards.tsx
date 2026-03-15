'use client'

import { useState } from 'react'
import { useServer } from '@/lib/server-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  SettingsIcon,
  RefreshCwIcon
} from 'lucide-react'
import type { ServerInfo, ServerMetrics } from '@/lib/types'

export function ServerInfoCard() {
  const { apiCall, isLoading } = useServer()
  const [info, setInfo] = useState<ServerInfo | null>(null)

  const fetchInfo = async () => {
    try {
      const data = await apiCall<ServerInfo>('info')
      setInfo(data)
      toast.success('Server info fetched')
    } catch {
      toast.error('Failed to fetch server info')
    }
  }

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
        {info && (
          <div className="p-3 rounded-lg bg-secondary/50 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name:</span>
              <span className="text-foreground font-medium">{info.serverName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version:</span>
              <span className="text-foreground font-medium">{info.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Description:</span>
              <span className="text-foreground font-medium text-right max-w-[200px] truncate">{info.description}</span>
            </div>
          </div>
        )}
        <Button 
          onClick={fetchInfo} 
          disabled={isLoading['info']} 
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isLoading['info'] ? <Spinner className="w-4 h-4 mr-2" /> : <RefreshCwIcon className="w-4 h-4 mr-2" />}
          Fetch Server Info
        </Button>
      </CardContent>
    </Card>
  )
}

export function PlayersCard() {
  const { apiCall, setPlayers, isLoading } = useServer()

  const fetchPlayers = async () => {
    try {
      const data = await apiCall<{ players: unknown[] }>('players')
      if (data?.players) {
        setPlayers(data.players as never[])
      }
      toast.success('Players list refreshed')
    } catch {
      toast.error('Failed to fetch players')
    }
  }

  return (
    <Card className="border-border/50 bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
            <UsersIcon className="w-5 h-5 text-chart-2" />
          </div>
          <div>
            <CardTitle className="text-foreground">Players</CardTitle>
            <CardDescription>Manage online players</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={fetchPlayers} 
          disabled={isLoading['players']}
          variant="secondary"
          className="w-full"
        >
          {isLoading['players'] ? <Spinner className="w-4 h-4 mr-2" /> : <RefreshCwIcon className="w-4 h-4 mr-2" />}
          Refresh Players
        </Button>
      </CardContent>
    </Card>
  )
}

export function AnnouncementCard() {
  const { apiCall, isLoading } = useServer()
  const [message, setMessage] = useState('')

  const sendAnnouncement = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message')
      return
    }
    try {
      await apiCall('announce', 'POST', { message })
      toast.success('Announcement sent')
      setMessage('')
    } catch {
      toast.error('Failed to send announcement')
    }
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
          onClick={sendAnnouncement} 
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

  const saveWorld = async () => {
    try {
      await apiCall('save', 'POST')
      toast.success('World saved successfully')
    } catch {
      toast.error('Failed to save world')
    }
  }

  const shutdownServer = async () => {
    try {
      await apiCall('shutdown', 'POST', { waittime: 10, message: 'Server shutting down...' })
      toast.success('Server shutdown initiated')
    } catch {
      toast.error('Failed to shutdown server')
    }
    setConfirmAction(null)
  }

  const stopServer = async () => {
    try {
      await apiCall('stop', 'POST')
      toast.success('Server stopped')
    } catch {
      toast.error('Failed to stop server')
    }
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
            disabled={isLoading['save']}
            variant="secondary"
            className="w-full"
          >
            {isLoading['save'] ? <Spinner className="w-4 h-4 mr-2" /> : <SaveIcon className="w-4 h-4 mr-2" />}
            Save World
          </Button>
          <Button 
            onClick={() => setConfirmAction('shutdown')}
            variant="outline"
            className="w-full border-warning/50 text-warning hover:bg-warning/10"
          >
            <PowerIcon className="w-4 h-4 mr-2" />
            Shutdown Server
          </Button>
          <Button 
            onClick={() => setConfirmAction('stop')}
            variant="outline"
            className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <StopCircleIcon className="w-4 h-4 mr-2" />
            Force Stop
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'shutdown' ? 'Shutdown Server' : 'Force Stop Server'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'shutdown' 
                ? 'This will gracefully shutdown the server after 10 seconds. Players will be notified.'
                : 'This will immediately stop the server. Unsaved progress may be lost!'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction === 'shutdown' ? shutdownServer : stopServer}
              className={confirmAction === 'stop' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-warning text-warning-foreground hover:bg-warning/90'}
            >
              {confirmAction === 'shutdown' ? 'Shutdown' : 'Force Stop'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function BanManagementCard() {
  const { apiCall, isLoading } = useServer()
  const [playerId, setPlayerId] = useState('')

  const handleBan = async () => {
    if (!playerId.trim()) {
      toast.error('Please enter a player ID')
      return
    }
    try {
      await apiCall('ban', 'POST', { userid: playerId })
      toast.success(`Player ${playerId} banned`)
      setPlayerId('')
    } catch {
      toast.error('Failed to ban player')
    }
  }

  const handleUnban = async () => {
    if (!playerId.trim()) {
      toast.error('Please enter a player ID')
      return
    }
    try {
      await apiCall('unban', 'POST', { userid: playerId })
      toast.success(`Player ${playerId} unbanned`)
      setPlayerId('')
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
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="playerId">Player ID / Steam ID</FieldLabel>
            <Input
              id="playerId"
              placeholder="Enter player ID..."
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
              className="bg-input border-border"
            />
          </Field>
        </FieldGroup>
        <div className="flex gap-2">
          <Button 
            onClick={handleBan}
            disabled={isLoading['ban']}
            variant="destructive"
            className="flex-1"
          >
            {isLoading['ban'] ? <Spinner className="w-4 h-4 mr-2" /> : null}
            Ban
          </Button>
          <Button 
            onClick={handleUnban}
            disabled={isLoading['unban']}
            variant="secondary"
            className="flex-1"
          >
            {isLoading['unban'] ? <Spinner className="w-4 h-4 mr-2" /> : null}
            Unban
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function MetricsCard() {
  const { apiCall, isLoading } = useServer()
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null)

  const fetchMetrics = async () => {
    try {
      const data = await apiCall<ServerMetrics>('metrics')
      setMetrics(data)
      toast.success('Metrics fetched')
    } catch {
      toast.error('Failed to fetch metrics')
    }
  }

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
        {metrics && (
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground">Server FPS</p>
              <p className="text-lg font-semibold text-foreground">{metrics.serverfps}</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground">Players</p>
              <p className="text-lg font-semibold text-foreground">{metrics.currentplayernum}/{metrics.maxplayernum}</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground">Frame Time</p>
              <p className="text-lg font-semibold text-foreground">{metrics.serverframetime?.toFixed(2)}ms</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/50">
              <p className="text-xs text-muted-foreground">Uptime</p>
              <p className="text-lg font-semibold text-foreground">{Math.floor((metrics.uptime || 0) / 3600)}h</p>
            </div>
          </div>
        )}
        <Button 
          onClick={fetchMetrics} 
          disabled={isLoading['metrics']}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isLoading['metrics'] ? <Spinner className="w-4 h-4 mr-2" /> : <RefreshCwIcon className="w-4 h-4 mr-2" />}
          Fetch Metrics
        </Button>
      </CardContent>
    </Card>
  )
}

export function SettingsCard() {
  const { apiCall, isLoading } = useServer()
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null)

  const fetchSettings = async () => {
    try {
      const data = await apiCall<Record<string, unknown>>('settings')
      setSettings(data)
      toast.success('Settings fetched')
    } catch {
      toast.error('Failed to fetch settings')
    }
  }

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
          <div className="p-3 rounded-lg bg-secondary/50 max-h-40 overflow-auto">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
              {JSON.stringify(settings, null, 2)}
            </pre>
          </div>
        )}
        <Button 
          onClick={fetchSettings} 
          disabled={isLoading['settings']}
          variant="secondary"
          className="w-full"
        >
          {isLoading['settings'] ? <Spinner className="w-4 h-4 mr-2" /> : <RefreshCwIcon className="w-4 h-4 mr-2" />}
          Fetch Settings
        </Button>
      </CardContent>
    </Card>
  )
}
