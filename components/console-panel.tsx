'use client'

import { useState } from 'react'
import { DataStream } from '@/components/data-stream'
import { useServer } from '@/lib/server-context'
import { useTranslation } from '@/lib/i18n/i18n-context'
import { Button } from '@/components/ui/button'
import { TrashIcon } from 'lucide-react'
import type { ConsoleLog } from '@/lib/types'

// REST operations we have a dedicated, human-readable label for (console.op.*).
// Anything outside this set falls back to showing the raw endpoint name, so a
// new endpoint still logs something sensible instead of a missing i18n key.
const KNOWN_OPS = new Set([
  'info', 'settings', 'players', 'server-snapshot',
  'announce', 'save', 'shutdown', 'stop', 'kick', 'ban', 'unban',
])

export function ConsolePanel() {
  const { consoleLogs, clearLogs } = useServer()
  const { t, locale } = useTranslation()
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set())

  // Human name of an operation (used inside error lines). Unknown endpoints
  // degrade to their raw name.
  const opName = (endpoint: string) =>
    KNOWN_OPS.has(endpoint) ? t(`console.op.${endpoint}.name`) : endpoint

  // The line shown for a log entry: a clear description of what happened,
  // translated at render time so it follows the language switch.
  const buildMessage = (log: ConsoleLog) => {
    if (log.type === 'success') {
      return KNOWN_OPS.has(log.endpoint)
        ? t(`console.op.${log.endpoint}.ok`, log.params)
        : t('console.genericOk', { action: log.endpoint })
    }
    return t('console.opError', {
      action: opName(log.endpoint),
      detail: log.detail ?? t('console.unknownError'),
    })
  }

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
    return new Date(date).toLocaleTimeString(locale === 'ru' ? 'ru-RU' : 'en-US', {
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
    text: `${buildMessage(log)}${log.rawResponse && expandedLogs.has(log.id) ? `\n${formatRawResponse(log.rawResponse)}` : ''}`,
    type: (log.type === 'success' ? 'success' : log.type === 'error' ? 'error' : 'info') as 'success' | 'error' | 'info',
    expanded: expandedLogs.has(log.id),
    onClick: log.rawResponse ? () => toggleExpand(log.id) : undefined,
  }))

  return (
    <div className="flex h-full min-h-[34rem] flex-col rounded border border-border/50 bg-card/50 p-3 backdrop-blur-sm sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:text-xs sm:tracking-[0.24em]">
          {t('console.feed', { count: consoleLogs.length })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearLogs}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <TrashIcon className="w-3 h-3 mr-1" />
          {t('console.clear')}
        </Button>
      </div>
      {/* Fill the grid cell: absolute inset feed never drives row height, scrolls internally. */}
      <div className="relative min-h-[10rem] flex-1 sm:min-h-[14rem]">
        <DataStream
          title={t('console.terminalTitle')}
          entries={
            streamEntries.length > 0
              ? streamEntries
              : [{ text: t('console.noLogs'), type: 'warning' as const }]
          }
          fill
          streaming={streamEntries.length > 0}
          hideScrollbar
          className="absolute inset-0"
        />
      </div>
    </div>
  )
}
