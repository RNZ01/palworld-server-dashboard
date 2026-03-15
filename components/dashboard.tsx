'use client'

import { useState } from 'react'
import { DashboardHeader } from '@/components/dashboard-header'
import { OnlinePlayersPanel } from '@/components/online-players-panel'
import { MobilePlayersSheet } from '@/components/mobile-players-sheet'
import { ConsolePanel } from '@/components/console-panel'
import {
  ServerInfoCard,
  AnnouncementCard,
  ServerManagementCard,
  BanManagementCard,
  MetricsCard,
  SettingsCard
} from '@/components/server-control-cards'
import { ScrollArea } from '@/components/ui/scroll-area'

export function Dashboard() {
  const [playersSheetOpen, setPlayersSheetOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DashboardHeader
        onPlayersClick={() => setPlayersSheetOpen(true)}
      />

      <div className="flex-1 flex lg:overflow-hidden">
        <div className="flex-1 flex flex-col lg:overflow-hidden">
          <div className="flex-1 flex lg:overflow-hidden">
            <main className="flex-1 flex flex-col lg:overflow-hidden">
              <div className="flex-1 overflow-y-auto lg:overflow-hidden">
                <ScrollArea className="h-full lg:h-auto lg:flex-1">
                  <div className="p-4 lg:p-6">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-foreground">Dashboard Overview</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Manage your Palworld server with ease
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

            <div className="hidden xl:flex">
              <OnlinePlayersPanel />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile players sheet */}
      <MobilePlayersSheet
        open={playersSheetOpen}
        onOpenChange={setPlayersSheetOpen}
      />
    </div>
  )
}
