'use client'

import { useState } from 'react'
import { useServer } from '@/lib/server-context'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { TerminalIcon, TrashIcon, CheckCircleIcon, XCircleIcon, InfoIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react'

export function ConsolePanel() {
  const { consoleLogs, clearLogs } = useServer()
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
      case 'error':
        return <XCircleIcon className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
      default:
        return <InfoIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
    }
  }

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatRawResponse = (raw: string) => {
    try {
      const parsed = JSON.parse(raw)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return raw
    }
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
      <ScrollArea className="h-48">
        <div className="p-2 font-mono text-xs">
          {consoleLogs.length === 0 ? (
            <div className="text-muted-foreground text-center py-4">
              No logs yet. API responses will appear here.
            </div>
          ) : (
            <div className="space-y-1">
              {consoleLogs.map((log) => {
                const isExpanded = expandedLogs.has(log.id)
                const hasRawResponse = !!log.rawResponse
                
                return (
                  <div
                    key={log.id}
                    className={cn(
                      "rounded overflow-hidden",
                      log.type === 'error' && "bg-destructive/10",
                      log.type === 'success' && "bg-primary/5"
                    )}
                  >
                    <div 
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5",
                        hasRawResponse && "cursor-pointer hover:bg-muted/30"
                      )}
                      onClick={() => hasRawResponse && toggleExpand(log.id)}
                    >
                      {hasRawResponse && (
                        isExpanded 
                          ? <ChevronDownIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          : <ChevronRightIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                      )}
                      {getLogIcon(log.type)}
                      <span className="text-muted-foreground flex-shrink-0">{formatTime(log.timestamp)}</span>
                      <span className={cn(
                        "truncate",
                        log.type === 'error' && "text-destructive",
                        log.type === 'success' && "text-primary",
                        log.type === 'info' && "text-foreground"
                      )}>
                        {log.message}
                      </span>
                    </div>
                    
                    {isExpanded && log.rawResponse && (
                      <div className="border-t border-border/50 bg-background/50 px-3 py-2 mx-2 mb-2 rounded">
                        <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Raw Response</div>
                        <pre className="text-[11px] text-foreground/80 whitespace-pre-wrap break-all max-h-48 overflow-auto">
                          {formatRawResponse(log.rawResponse)}
                        </pre>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
