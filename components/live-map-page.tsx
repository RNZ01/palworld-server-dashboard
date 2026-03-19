'use client'

import { DashboardHeader } from '@/components/dashboard-header'
import { HUDCornerFrame } from '@/components/hud-corner-frame'
import { StatusBar } from '@/components/status-bar'
import { LiveMap } from '@/components/live-map'
import { useServer } from '@/lib/server-context'

export function LiveMapPage() {
  const { connectionStatus, players } = useServer()

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DashboardHeader />
      <div className="flex-1 lg:overflow-hidden">
        <main className="mx-auto flex h-full w-full max-w-[1680px] flex-col gap-4 px-3 py-3 sm:px-4 lg:px-6 lg:py-4">
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
        </main>
      </div>
    </div>
  )
}
