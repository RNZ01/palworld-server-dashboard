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
      <main className="flex-1 overflow-hidden p-3 sm:p-4 lg:p-6">
        <div className="mx-auto flex h-full max-w-[1680px] flex-col gap-4">
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

          <div className="relative h-full min-h-[calc(100vh-8.5rem)] overflow-hidden rounded-[1.75rem] border border-border bg-card/60 shadow-2xl shadow-black/20">
            <HUDCornerFrame position="top-left" size={48} />
            <HUDCornerFrame position="top-right" size={48} />
            <HUDCornerFrame position="bottom-left" size={48} />
            <HUDCornerFrame position="bottom-right" size={48} />
          <LiveMap />
          </div>
        </div>
      </main>
    </div>
  )
}
