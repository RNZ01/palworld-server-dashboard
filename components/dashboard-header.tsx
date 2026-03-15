'use client'

import { useServer } from '@/lib/server-context'
import { Button } from '@/components/ui/button'
import { ServerIcon, LogOutIcon, MenuIcon, UsersIcon } from 'lucide-react'

interface DashboardHeaderProps {
  onMenuClick: () => void
  onPlayersClick?: () => void
}

export function DashboardHeader({ onMenuClick, onPlayersClick }: DashboardHeaderProps) {
  const { config, clearConfig, players } = useServer()

  return (
    <header className="h-14 sm:h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-3 sm:px-4 lg:px-6">
      <div className="flex items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-9 w-9"
          onClick={onMenuClick}
        >
          <MenuIcon className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ServerIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-semibold text-foreground">Palworld Admin</h1>
            <p className="text-xs text-muted-foreground">
              {config?.serverIp}:{config?.restApiPort}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Mobile: Connected indicator + player count */}
        <div className="flex md:hidden items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-medium text-primary">Online</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onPlayersClick}
            className="h-7 px-2 text-xs gap-1 xl:hidden"
          >
            <UsersIcon className="w-3 h-3" />
            <span>{players.length}</span>
          </Button>
        </div>
        
        {/* Desktop: Full connected badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-medium text-primary">Connected</span>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={clearConfig}
          className="text-muted-foreground hover:text-destructive h-8 sm:h-9 px-2 sm:px-3"
        >
          <LogOutIcon className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Disconnect</span>
        </Button>
      </div>
    </header>
  )
}
