'use client'

import { useServer } from '@/lib/server-context'
import { useTheme } from '@/lib/theme-context'
import { InfoPanel } from '@/components/status-bar'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignalIndicator } from '@/components/signal-indicator'
import { UplinkHeader } from '@/components/uplink-header'
import { PaletteIcon } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'

interface DashboardHeaderProps {
  onPlayersClick?: () => void
}

export function DashboardHeader({ onPlayersClick }: DashboardHeaderProps) {
  const { config, clearConfig, players, connectionStatus } = useServer()
  const { theme, setTheme, themes } = useTheme()
  const pathname = usePathname()
  const router = useRouter()

  const statusLabel = connectionStatus === 'connected'
    ? 'LINK STABLE'
    : connectionStatus === 'checking'
      ? 'VERIFYING'
      : 'OFFLINE'

  const panelStatus = connectionStatus === 'connected'
    ? 'complete'
    : connectionStatus === 'checking'
      ? 'pending'
      : 'active'

  const signalStrength = connectionStatus === 'connected' ? 100 : connectionStatus === 'checking' ? 45 : 0
  const currentTab = pathname === '/map' ? '/map' : '/'

  return (
    <header>
      <div className="mx-auto w-full max-w-[1680px] px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6">
        <InfoPanel
          title="Palworld Admin"
          subtitle={config ? `${config.serverIp}:${config.restApiPort}` : 'Awaiting Server Link'}
          status={panelStatus}
          className="overflow-visible"
        >
          <UplinkHeader
            leftText="COMMAND NAVIGATION"
            rightText={config ? `${config.serverIp}:${config.restApiPort}` : 'NO TARGET'}
            variant={connectionStatus === 'connected' ? 'cyan' : connectionStatus === 'checking' ? 'amber' : 'orange'}
            className="mb-4 -mx-4 sm:-mx-4"
          />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <SignalIndicator
                strength={signalStrength}
                label="Uplink"
                showValue
                status={connectionStatus === 'connected' ? 'connected' : connectionStatus === 'checking' ? 'weak' : 'disconnected'}
              />
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
                  Control Channel
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <span className="font-mono text-sm uppercase tracking-[0.18em] text-primary">{statusLabel}</span>
                  <span className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    {players.length.toString().padStart(2, '0')} Operators Tracked
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Tabs value={currentTab} onValueChange={(value) => router.push(value)}>
                <TabsList className="h-10 rounded-md border border-border/60 bg-muted/20">
                  <TabsTrigger value="/" className="px-4 font-mono text-[11px] uppercase tracking-[0.2em]">
                    Dashboard
                  </TabsTrigger>
                  <TabsTrigger value="/map" className="px-4 font-mono text-[11px] uppercase tracking-[0.2em]">
                    Live Map
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 font-mono text-[11px] uppercase tracking-[0.2em]"
                  >
                    <PaletteIcon className="h-3.5 w-3.5" />
                    Theme {themes.find((item) => item.value === theme)?.label ?? 'Tron'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {themes.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{option.label}</span>
                      <span
                        className="h-2.5 w-2.5 rounded-full border border-white/20"
                        style={{ backgroundColor: option.accent }}
                      />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {onPlayersClick && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPlayersClick}
                  className="h-8 font-mono text-[11px] uppercase tracking-[0.2em] xl:hidden"
                >
                  Roster {players.length}
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={clearConfig}
                className="h-8 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground hover:text-destructive"
              >
                <span>Disconnect</span>
              </Button>
            </div>
          </div>
        </InfoPanel>
      </div>
    </header>
  )
}
