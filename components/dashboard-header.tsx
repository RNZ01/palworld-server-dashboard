'use client'

import { useServer } from '@/lib/server-context'
import { Button } from '@/components/ui/button'
import { ServerIcon, LogOutIcon, MenuIcon } from 'lucide-react'

interface DashboardHeaderProps {
  onMenuClick: () => void
}

export function DashboardHeader({ onMenuClick }: DashboardHeaderProps) {
  const { config, clearConfig } = useServer()

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onMenuClick}
        >
          <MenuIcon className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ServerIcon className="w-4 h-4 text-primary" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold text-foreground">Palworld Admin</h1>
            <p className="text-xs text-muted-foreground">
              {config?.serverIp}:{config?.restApiPort}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium text-primary">Connected</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearConfig}
          className="text-muted-foreground hover:text-destructive"
        >
          <LogOutIcon className="w-4 h-4 mr-2" />
          <span className="hidden sm:inline">Disconnect</span>
        </Button>
      </div>
    </header>
  )
}
