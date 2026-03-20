'use client'

import { useEffect } from 'react'
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
import { CheckIcon, PaletteIcon } from 'lucide-react'

type DashboardTab = 'dashboard' | 'map'

interface DashboardHeaderProps {
  activeTab?: DashboardTab
  onTabChange?: (tab: DashboardTab) => void
  onPlayersClick?: () => void
}

export function DashboardHeader({ activeTab = 'dashboard', onTabChange, onPlayersClick }: DashboardHeaderProps) {
  const { config, clearConfig, players, connectionStatus } = useServer()
  const { theme, setTheme, themes } = useTheme()

  useEffect(() => {
    document.body.classList.add('dashboard-interactive-glow')

    return () => {
      document.body.classList.remove('dashboard-interactive-glow')
    }
  }, [])

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
  const currentTab = activeTab

  return (
    <header>
      <div className="mx-auto w-full max-w-[1680px] px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6">
        <InfoPanel
          title="Palworld Admin"
          subtitle={config ? `${config.serverIp}:${config.restApiPort} | Game ${config.gamePort}` : 'Awaiting Server Link'}
          status={panelStatus}
          className="overflow-visible"
        >
          <UplinkHeader
            leftText="COMMAND NAVIGATION"
            rightText={config ? `${config.serverIp}:${config.restApiPort} | G:${config.gamePort}` : 'NO TARGET'}
            variant={connectionStatus === 'connected' ? 'cyan' : connectionStatus === 'checking' ? 'amber' : 'orange'}
            className="mb-4 -mx-4 sm:-mx-4"
          />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3 sm:items-center">
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
                  <span className="font-mono text-xs uppercase tracking-[0.16em] text-primary sm:text-sm sm:tracking-[0.18em]">{statusLabel}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:text-xs sm:tracking-[0.22em]">
                    {players.length.toString().padStart(2, '0')} Operators Tracked
                  </span>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
              <Tabs
                value={currentTab}
                onValueChange={(value) => onTabChange?.(value === 'map' ? 'map' : 'dashboard')}
                className="w-full sm:w-auto"
              >
                <TabsList className="h-10 w-full rounded-md border border-border/60 bg-muted/20 sm:w-auto">
                  <TabsTrigger value="dashboard" className="px-3 font-mono text-[11px] uppercase tracking-[0.2em] data-[state=active]:border-primary/60 data-[state=active]:bg-primary/10 data-[state=active]:text-primary sm:px-4">
                    Dashboard
                  </TabsTrigger>
                  <TabsTrigger value="map" className="px-3 font-mono text-[11px] uppercase tracking-[0.2em] data-[state=active]:border-primary/60 data-[state=active]:bg-primary/10 data-[state=active]:text-primary sm:px-4">
                    Live Map
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1 justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] sm:flex-none"
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
                      data-selected={theme === option.value ? 'true' : 'false'}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{option.label}</span>
                        {theme === option.value && <CheckIcon className="h-3.5 w-3.5 text-primary" />}
                      </span>
                      <span className="flex items-center gap-2">
                        {theme === option.value && (
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Selected</span>
                        )}
                        <span
                          className="status-dot h-2.5 w-2.5 rounded-full border border-white/20"
                          style={{ backgroundColor: option.accent }}
                        />
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {onPlayersClick && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPlayersClick}
                  className="h-8 flex-1 justify-center font-mono text-[11px] uppercase tracking-[0.2em] sm:flex-none xl:hidden"
                >
                  Roster {players.length}
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={clearConfig}
                className="no-interactive-glow h-8 flex-1 justify-center font-mono text-[11px] uppercase tracking-[0.2em] text-destructive hover:!bg-destructive hover:!text-destructive-foreground sm:flex-none"
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
