'use client'

import { useState } from 'react'
import { DataStream } from '@/components/data-stream'
import { useServer } from '@/lib/server-context'
import { Button } from '@/components/ui/button'
import { TrashIcon } from 'lucide-react'

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

  const streamEntries = [...consoleLogs].reverse().map((log) => ({
    id: log.id,
    timestamp: formatTime(log.timestamp),
    text: `${log.message}${log.rawResponse && expandedLogs.has(log.id) ? `\n${formatRawResponse(log.rawResponse)}` : ''}`,
    type: (log.type === 'success' ? 'success' : log.type === 'error' ? 'error' : 'info') as 'success' | 'error' | 'info',
    expanded: expandedLogs.has(log.id),
    onClick: log.rawResponse ? () => toggleExpand(log.id) : undefined,
  }))

  return (
    <div className="border-t border-border/50 bg-card/20 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:text-xs sm:tracking-[0.24em]">
          Console Feed ({consoleLogs.length})
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
      <DataStream
        title="SYSTEM TERMINAL"
        entries={
          streamEntries.length > 0
            ? streamEntries
            : [{ text: 'NO LOGS YET. API RESPONSES WILL APPEAR HERE.', type: 'warning' as const }]
        }
        maxVisible={10}
        streaming={streamEntries.length > 0}
        hideScrollbar
        className="min-h-[10rem] sm:min-h-[14rem]"
      />
    </div>
  )
}
