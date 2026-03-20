'use client'

import { useState } from 'react'
import { DashboardHeader } from '@/components/dashboard-header'
import { DataCard } from '@/components/data-card'
import { OnlinePlayersPanel } from '@/components/online-players-panel'
import { MobilePlayersSheet } from '@/components/mobile-players-sheet'
import { ConsolePanel } from '@/components/console-panel'
import { HUDCornerFrame } from '@/components/hud-corner-frame'
import { LiveMap } from '@/components/live-map'
import { InfoPanel, StatusBar } from '@/components/status-bar'
import {
  ServerInfoCard,
  AnnouncementCard,
  ServerManagementCard,
  BanManagementCard,
  MetricsCard,
  SettingsCard
} from '@/components/server-control-cards'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useServer } from '@/lib/server-context'

export function Dashboard() {
  const { config, connectionStatus, players, serverInfo, serverMetrics } = useServer()
  const [playersSheetOpen, setPlayersSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map'>('dashboard')

  const statusVariant = connectionStatus === 'connected'
    ? 'info'
    : connectionStatus === 'checking'
      ? 'default'
      : 'alert'

  const statusText = connectionStatus.toUpperCase()

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onPlayersClick={activeTab === 'dashboard' ? () => setPlayersSheetOpen(true) : undefined}
      />

      <div className="flex-1 lg:overflow-hidden">
        {activeTab === 'dashboard' ? (
          <div key="dashboard-tab" className="dashboard-tab-content dashboard-tab-content-animate mx-auto flex h-full w-full max-w-[1680px] flex-col gap-4 px-3 py-3 sm:px-4 lg:px-6 lg:py-4">
            <StatusBar
              variant={statusVariant}
              leftContent={
                <>
                  <span>PALWORLD UPLINK</span>
                  <span>{serverInfo?.servername ?? 'UNASSIGNED SERVER'}</span>
                </>
              }
            />

            <div className="grid gap-4 xl:grid-cols-[1.6fr_repeat(3,minmax(0,1fr))]">
              <InfoPanel
                title="Command Nexus"
                subtitle={config ? `${config.serverIp}:${config.restApiPort} | Game ${config.gamePort}` : 'Awaiting Link'}
                status={connectionStatus === 'connected' ? 'complete' : connectionStatus === 'checking' ? 'pending' : 'active'}
                className="min-h-[180px]"
              >
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Coordinate live operations, player moderation, diagnostics, and world-state changes from one control surface.
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded border border-border/50 bg-muted/20 px-3 py-2 font-mono text-xs uppercase tracking-widest text-foreground/80">
                    <div className="text-[10px] text-muted-foreground">Uplink</div>
                    <div className="mt-1 text-primary">{statusText}</div>
                  </div>
                  <div className="rounded border border-border/50 bg-muted/20 px-3 py-2 font-mono text-xs uppercase tracking-widest text-foreground/80">
                    <div className="text-[10px] text-muted-foreground">Players</div>
                    <div className="mt-1 text-primary">{players.length.toString().padStart(2, '0')}</div>
                  </div>
                  <div className="rounded border border-border/50 bg-muted/20 px-3 py-2 font-mono text-xs uppercase tracking-widest text-foreground/80">
                    <div className="text-[10px] text-muted-foreground">Uptime</div>
                    <div className="mt-1 text-primary">{serverMetrics?.uptime ? `${Math.floor(serverMetrics.uptime / 3600)}H` : 'N/A'}</div>
                  </div>
                </div>
              </InfoPanel>

              <DataCard
                title="Network"
                subtitle="Server Link"
                status={connectionStatus === 'disconnected' ? 'alert' : 'active'}
                fields={[
                  { label: 'Host', value: config?.serverIp ?? 'Not linked' },
                  { label: 'REST Port', value: config?.restApiPort ?? '----' },
                  { label: 'Game Port', value: config?.gamePort ?? '----' },
                ]}
              />

              <DataCard
                title="Session"
                subtitle="Live Metrics"
                fields={[
                  { label: 'Online', value: `${players.length}` },
                  { label: 'FPS', value: serverMetrics?.serverfps ? `${serverMetrics.serverfps.toFixed(0)}` : 'N/A', highlight: true },
                ]}
              />

              <DataCard
                title="World"
                subtitle="Server State"
                fields={[
                  { label: 'Day', value: serverMetrics?.days ? `${serverMetrics.days}` : 'N/A' },
                  { label: 'Bases', value: serverMetrics?.basecampnum ? `${serverMetrics.basecampnum}` : 'N/A' },
                ]}
              />
            </div>

            <div className="flex min-h-0 flex-1 gap-4 lg:overflow-hidden">
              <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur-sm lg:rounded-[1.75rem]">
                <HUDCornerFrame position="top-left" size={44} className="hidden lg:block" />
                <HUDCornerFrame position="top-right" size={44} className="hidden lg:block" />
                <HUDCornerFrame position="bottom-left" size={44} className="hidden lg:block" />
                <HUDCornerFrame position="bottom-right" size={44} className="hidden lg:block" />

                <main className="flex min-h-0 flex-1 flex-col lg:overflow-hidden">
                  <div className="flex-1 overflow-y-auto lg:overflow-hidden">
                    <ScrollArea className="h-full lg:h-auto lg:flex-1">
                      <div className="p-3 sm:p-4 lg:p-6">
                        <div className="mb-6">
                          <h2 className="font-mono text-lg font-semibold uppercase tracking-[0.14em] text-foreground sm:text-2xl sm:tracking-[0.24em]">Dashboard Overview</h2>
                          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                            Operate your Palworld server with live HUD panels, moderation tools, diagnostics, and real-time control surfaces.
                          </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          <ServerInfoCard />
                          <AnnouncementCard />
                          <ServerManagementCard />
                          <BanManagementCard />
                          <MetricsCard />
                          <SettingsCard />
                        </div>
                      </div>
                    </ScrollArea>
                  </div>
                  <ConsolePanel />
                </main>
              </div>

              <div className="hidden xl:flex xl:min-h-0">
                <OnlinePlayersPanel />
              </div>
            </div>
          </div>
        ) : (
          <div key="map-tab" className="dashboard-tab-content dashboard-tab-content-animate mx-auto flex h-full w-full max-w-[1680px] flex-col gap-4 px-3 py-3 sm:px-4 lg:px-6 lg:py-4">
            <StatusBar
              variant={connectionStatus === 'connected' ? 'info' : connectionStatus === 'checking' ? 'default' : 'alert'}
              leftContent={
                <>
                  <span>TACTICAL MAP</span>
                  <span>WORLD OVERLAY ACTIVE</span>
                </>
              }
              rightContent={
                <>
                  <span>{connectionStatus.toUpperCase()}</span>
                  <span>{players.length.toString().padStart(2, '0')} TRACKED</span>
                </>
              }
            />

            <div className="relative h-full w-full min-h-[calc(100vh-8.5rem)] overflow-hidden rounded-[1.75rem] border border-border bg-card/60 shadow-2xl shadow-black/20">
              <HUDCornerFrame position="top-left" size={48} className="hidden lg:block" />
              <HUDCornerFrame position="top-right" size={48} className="hidden lg:block" />
              <HUDCornerFrame position="bottom-left" size={48} className="hidden lg:block" />
              <HUDCornerFrame position="bottom-right" size={48} className="hidden lg:block" />
              <LiveMap />
            </div>
          </div>
        )}
      </div>

      {/* Mobile players sheet */}
      <MobilePlayersSheet
        open={playersSheetOpen}
        onOpenChange={setPlayersSheetOpen}
      />
    </div>
  )
}
