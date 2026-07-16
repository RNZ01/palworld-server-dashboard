'use client'

import { useCallback, useEffect, useState } from 'react'
import { DashboardHeader } from '@/components/dashboard-header'
import { OnlinePlayersPanel } from '@/components/online-players-panel'
import { MobilePlayersSheet } from '@/components/mobile-players-sheet'
import { ConsolePanel } from '@/components/console-panel'
import { ChatPanel } from '@/components/chat-panel'
import { HUDCornerFrame } from '@/components/hud-corner-frame'
import { LiveMap } from '@/components/live-map'
import { StatusBar } from '@/components/status-bar'
import { WorldPanels } from '@/components/world-panels'
import {
  AnnouncementCard,
  ServerManagementCard,
  BanManagementCard,
  MetricsCard,
  SettingsCard
} from '@/components/server-control-cards'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useServer } from '@/lib/server-context'

const ACTIVE_TAB_STORAGE_KEY = 'activeDashboardTab'

type DashboardTab = 'dashboard' | 'map'

function readStoredTab(): DashboardTab {
  // Dashboard only mounts client-side (RequireServerConfig gates on post-mount
  // config hydration), so reading localStorage in the initializer is safe.
  if (typeof window === 'undefined') {
    return 'dashboard'
  }

  return window.localStorage.getItem(ACTIVE_TAB_STORAGE_KEY) === 'map' ? 'map' : 'dashboard'
}

export function Dashboard() {
  const { connectionStatus, players } = useServer()
  const [playersSheetOpen, setPlayersSheetOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>(readStoredTab)

  // Interactive-glow theme spans BOTH dashboard and map tabs (moved here from
  // DashboardHeader, which unmounts on the map tab and took the glow with it).
  useEffect(() => {
    document.body.classList.add('dashboard-interactive-glow')
    return () => document.body.classList.remove('dashboard-interactive-glow')
  }, [])

  const handleTabChange = useCallback((tab: DashboardTab) => {
    setActiveTab(tab)
    window.localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, tab)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      {activeTab === 'dashboard' && (
        <DashboardHeader
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onPlayersClick={() => setPlayersSheetOpen(true)}
        />
      )}

      <div className="flex-1 lg:overflow-hidden">
        {activeTab === 'dashboard' ? (
          <div key="dashboard-tab" className="dashboard-tab-content dashboard-tab-content-animate mx-auto flex h-full w-full max-w-[1680px] flex-col gap-4 px-3 py-3 sm:px-4 lg:px-6 lg:py-4">
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
                        </div>

                        {/* Hero: live performance */}
                        <div className="mb-4">
                          <MetricsCard />
                        </div>

                        {/* Top row: live feeds, kept tall (feeds have no intrinsic height). */}
                        <div className="grid gap-4 [grid-auto-rows:1fr] md:grid-cols-2 xl:grid-cols-3">
                          <BanManagementCard />
                          <ConsolePanel />
                          <ChatPanel />
                        </div>

                        {/* Bottom row: config/controls sized to their own content — lines
                            up with the Announcements card (Config Snapshot JSON flexes). */}
                        <div className="mt-4 grid gap-4 [grid-auto-rows:1fr] md:grid-cols-2 xl:grid-cols-3">
                          <SettingsCard />
                          <ServerManagementCard />
                          <AnnouncementCard />
                        </div>

                        <div className="mt-4">
                          <WorldPanels />
                        </div>
                      </div>
                    </ScrollArea>
                  </div>
                </main>
              </div>

              <div className="hidden xl:flex xl:min-h-0">
                <OnlinePlayersPanel />
              </div>
            </div>
          </div>
        ) : (
          <div key="map-tab" className="dashboard-tab-content dashboard-tab-content-animate flex h-dvh w-full flex-col">
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

            <div className="relative min-h-0 w-full flex-1 overflow-hidden bg-card/60">
              <HUDCornerFrame position="top-left" size={48} className="hidden lg:block" />
              <HUDCornerFrame position="top-right" size={48} className="hidden lg:block" />
              <HUDCornerFrame position="bottom-left" size={48} className="hidden lg:block" />
              <HUDCornerFrame position="bottom-right" size={48} className="hidden lg:block" />
              <LiveMap activeTab={activeTab} onTabChange={handleTabChange} />
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
