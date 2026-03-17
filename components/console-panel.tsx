'use client'

import { useState } from 'react'
import { Terminal } from '@/components/terminal'
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

  const terminalLines = consoleLogs.map((log) => ({
    id: log.id,
    text: `[${formatTime(log.timestamp)}] ${log.message}${log.rawResponse && expandedLogs.has(log.id) ? `\n${formatRawResponse(log.rawResponse)}` : ''}`,
    type: (log.type === 'success' ? 'success' : log.type === 'error' ? 'error' : 'output') as 'success' | 'error' | 'output',
    expanded: expandedLogs.has(log.id),
    onClick: log.rawResponse ? () => toggleExpand(log.id) : undefined,
  }))

  return (
    <div className="border-t border-border/50 bg-card/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="font-mono text-xs uppercase tracking-[0.24em] text-muted-foreground">
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
      {consoleLogs.length === 0 ? (
        <Terminal
          title="SYSTEM TERMINAL"
          lines={[{ text: 'NO LOGS YET. API RESPONSES WILL APPEAR HERE.', type: 'system' }]}
          typewriter={false}
          className="min-h-[14rem]"
        />
      ) : (
        <Terminal
          title="SYSTEM TERMINAL"
          lines={terminalLines}
          typewriter={false}
          className="min-h-[14rem]"
        />
      )}
    </div>
  )
}
