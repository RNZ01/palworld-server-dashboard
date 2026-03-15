'use client'

import { useState } from 'react'
import { DashboardHeader } from '@/components/dashboard-header'
import { DashboardSidebar } from '@/components/dashboard-sidebar'
import { OnlinePlayersPanel } from '@/components/online-players-panel'
import { ConsolePanel } from '@/components/console-panel'
import { 
  ServerInfoCard, 
  PlayersCard, 
  AnnouncementCard, 
  ServerManagementCard,
  BanManagementCard,
  MetricsCard,
  SettingsCard
} from '@/components/server-control-cards'
import { ScrollArea } from '@/components/ui/scroll-area'

export function Dashboard() {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const renderContent = () => {
    switch (activeSection) {
      case 'server-info':
        return (
          <div className="max-w-2xl mx-auto">
            <ServerInfoCard />
          </div>
        )
      case 'players':
        return (
          <div className="max-w-2xl mx-auto">
            <PlayersCard />
          </div>
        )
      case 'announcements':
        return (
          <div className="max-w-2xl mx-auto">
            <AnnouncementCard />
          </div>
        )
      case 'server-management':
        return (
          <div className="max-w-2xl mx-auto">
            <ServerManagementCard />
          </div>
        )
      case 'ban-management':
        return (
          <div className="max-w-2xl mx-auto">
            <BanManagementCard />
          </div>
        )
      case 'metrics':
        return (
          <div className="max-w-2xl mx-auto">
            <MetricsCard />
          </div>
        )
      default:
        return (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ServerInfoCard />
            <PlayersCard />
            <AnnouncementCard />
            <ServerManagementCard />
            <BanManagementCard />
            <MetricsCard />
            <SettingsCard />
          </div>
        )
    }
  }

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'server-info':
        return 'Server Information'
      case 'players':
        return 'Players Management'
      case 'announcements':
        return 'Server Announcements'
      case 'server-management':
        return 'Server Management'
      case 'ban-management':
        return 'Ban Management'
      case 'metrics':
        return 'Server Metrics'
      default:
        return 'Dashboard Overview'
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
      
      <div className="flex-1 flex overflow-hidden">
        <DashboardSidebar 
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex overflow-hidden">
            <main className="flex-1 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-4 lg:p-6">
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-foreground">{getSectionTitle()}</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage your Palworld server with ease
                    </p>
                  </div>
                  {renderContent()}
                </div>
              </ScrollArea>
              <ConsolePanel />
            </main>
            
            <div className="hidden xl:flex">
              <OnlinePlayersPanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
