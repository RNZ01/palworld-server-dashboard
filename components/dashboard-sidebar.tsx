'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  LayoutDashboardIcon, 
  UsersIcon, 
  MegaphoneIcon, 
  SettingsIcon, 
  ServerIcon,
  ActivityIcon,
  ShieldIcon,
  XIcon
} from 'lucide-react'

interface DashboardSidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
  isOpen: boolean
  onClose: () => void
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboardIcon },
  { id: 'server-info', label: 'Server Info', icon: ServerIcon },
  { id: 'players', label: 'Players', icon: UsersIcon },
  { id: 'announcements', label: 'Announcements', icon: MegaphoneIcon },
  { id: 'server-management', label: 'Server Management', icon: SettingsIcon },
  { id: 'ban-management', label: 'Ban Management', icon: ShieldIcon },
  { id: 'metrics', label: 'Metrics', icon: ActivityIcon },
]

export function DashboardSidebar({ activeSection, onSectionChange, isOpen, onClose }: DashboardSidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border lg:hidden">
          <span className="font-semibold text-sidebar-foreground">Navigation</span>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <XIcon className="w-5 h-5" />
          </Button>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSectionChange(item.id)
                onClose()
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                activeSection === item.id
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="p-3 rounded-lg bg-sidebar-accent">
            <p className="text-xs font-medium text-sidebar-foreground">Quick Tip</p>
            <p className="text-xs text-sidebar-foreground/60 mt-1">
              Use the online players panel to quickly manage connected players.
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
