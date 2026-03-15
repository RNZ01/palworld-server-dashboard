'use client'

import { useServer } from '@/lib/server-context'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { TerminalIcon, TrashIcon, CheckCircleIcon, XCircleIcon, InfoIcon } from 'lucide-react'

export function ConsolePanel() {
  const { consoleLogs, clearLogs } = useServer()

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="w-3.5 h-3.5 text-primary" />
      case 'error':
        return <XCircleIcon className="w-3.5 h-3.5 text-destructive" />
      default:
        return <InfoIcon className="w-3.5 h-3.5 text-muted-foreground" />
    }
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <div className="border-t border-border bg-card/30">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Console</span>
          <span className="text-xs text-muted-foreground">({consoleLogs.length} logs)</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearLogs}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <TrashIcon className="w-3 h-3 mr-1" />
          Clear
        </Button>
      </div>
      <ScrollArea className="h-32">
        <div className="p-2 font-mono text-xs">
          {consoleLogs.length === 0 ? (
            <div className="text-muted-foreground text-center py-4">
              No logs yet. API responses will appear here.
            </div>
          ) : (
            <div className="space-y-1">
              {consoleLogs.map((log) => (
                <div
                  key={log.id}
                  className={cn(
                    "flex items-start gap-2 px-2 py-1 rounded",
                    log.type === 'error' && "bg-destructive/10",
                    log.type === 'success' && "bg-primary/5"
                  )}
                >
                  {getLogIcon(log.type)}
                  <span className="text-muted-foreground">{formatTime(log.timestamp)}</span>
                  <span className={cn(
                    log.type === 'error' && "text-destructive",
                    log.type === 'success' && "text-primary",
                    log.type === 'info' && "text-foreground"
                  )}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
