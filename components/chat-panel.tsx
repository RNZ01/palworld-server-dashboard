'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { PanelSection } from '@/components/server-control-cards'
import { useServer } from '@/lib/server-context'
import {
  PALWORLD_PROXY_HEADERS,
  buildPalworldProxyHeaders,
  buildPalworldProxyPath,
} from '@/lib/palworld'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { SendIcon } from 'lucide-react'

// Poll cadence for the live chat/presence feed (mirrors palcon's terminal tail).
const CHAT_POLL_INTERVAL_MS = 4 * 1000

// Web sends announce as "Kanrinin: <msg>" so web + palcon look identical in-game.
const CHAT_SENDER_PREFIX = 'Kanrinin: '

type ChatEvent = {
  type: 'chat' | 'join' | 'leave'
  ts: string
  name: string
  text?: string
}

function eventKey(event: ChatEvent, index: number) {
  return `${event.ts}|${event.type}|${event.name}|${index}`
}

function ChatRow({ event }: { event: ChatEvent }) {
  return (
    <div className="flex items-start gap-2 border-b border-border/20 px-4 py-1.5">
      <span className="mt-0.5 shrink-0 font-mono text-[10px] tabular-nums text-foreground/30">
        {event.ts}
      </span>
      <span className="min-w-0 break-words leading-relaxed">
        {event.type === 'chat' ? (
          <>
            <b className="font-semibold text-foreground">{event.name || 'unknown'}</b>
            <span className="text-foreground/40">: </span>
            <span className="text-foreground/90">{event.text}</span>
          </>
        ) : event.type === 'join' ? (
          <span className="text-green-500/90">→ {event.name} joined</span>
        ) : (
          <span className="text-muted-foreground">← {event.name} left</span>
        )}
      </span>
    </div>
  )
}

export function ChatPanel() {
  const { config } = useServer()
  const [events, setEvents] = useState<ChatEvent[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const feedRef = useRef<HTMLDivElement | null>(null)
  // Only auto-scroll when the operator is already pinned to the bottom, so
  // scrolling up to read history isn't yanked back down on the next poll.
  const atBottomRef = useRef(true)

  // Live feed: poll /api/chat every 4s with the admin password header.
  useEffect(() => {
    if (!config) {
      setEvents([])
      return
    }

    let cancelled = false

    const poll = async () => {
      try {
        const response = await fetch('/api/chat', {
          headers: { [PALWORLD_PROXY_HEADERS.adminPassword]: config.adminPassword },
          cache: 'no-store',
        })
        if (!response.ok) return
        const data = (await response.json()) as { events?: ChatEvent[] }
        if (!cancelled && Array.isArray(data.events)) {
          setEvents(data.events.filter((e: ChatEvent) => e.type === 'chat'))
        }
      } catch {
        // Transient network hiccup — keep the last feed we had.
      }
    }

    void poll()
    const interval = window.setInterval(poll, CHAT_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [config])

  // Stick to bottom on new events when already at bottom.
  useEffect(() => {
    const el = feedRef.current
    if (el && atBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [events])

  const handleScroll = useCallback(() => {
    const el = feedRef.current
    if (!el) return
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || sending || !config) return

    setSending(true)
    try {
      const headers = new Headers(buildPalworldProxyHeaders(config))
      headers.set('Content-Type', 'application/json')

      const response = await fetch(buildPalworldProxyPath('announce'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: `${CHAT_SENDER_PREFIX}${text}` }),
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('send failed')

      setInput('')
      // Next poll surfaces the message; make sure we're pinned to see it.
      atBottomRef.current = true
    } catch {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }, [input, sending, config])

  const handleSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault()
      void sendMessage()
    },
    [sendMessage],
  )

  return (
    <PanelSection
      title="Chat"
      subtitle="Live Game Chat"
      status="active"
      contentClassName="mt-0 flex min-h-0 flex-1 flex-col gap-3"
    >
      {/* Console-style feed shell (DataStream aesthetic). */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-primary/30 bg-card/80 backdrop-blur-sm">
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)]" />

        <div className="relative z-10 flex items-center gap-2 border-b border-border/50 px-4 py-2">
          <div className="status-dot h-1.5 w-1.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
          <span className="text-[10px] uppercase tracking-widest text-foreground/80">Live Game Chat</span>
          <span className="ml-auto font-mono text-[10px] text-foreground/40">{events.length}</span>
        </div>

        <div className="relative z-10 min-h-0 flex-1">
          <div
            ref={feedRef}
            onScroll={handleScroll}
            className="scrollbar-hidden absolute inset-0 overflow-y-auto font-mono text-xs"
          >
            {events.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 py-8 text-center font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                No chat yet. Player messages will appear here.
              </div>
            ) : (
              events.map((event, index) => <ChatRow key={eventKey(event, index)} event={event} />)
            )}
          </div>
        </div>
      </div>

      {/* Custom message sender — pinned at the bottom, mirrors palcon identity. */}
      <form onSubmit={handleSubmit} className="flex shrink-0 items-center gap-2">
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Message as Kanrinin…"
          disabled={sending}
          aria-label="Chat message"
          className="flex-1 font-mono text-xs"
        />
        <Button
          type="submit"
          size="sm"
          disabled={sending || !input.trim()}
          className={cn('shrink-0 bg-chart-2 text-background hover:bg-chart-2/90')}
        >
          <SendIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Send</span>
        </Button>
      </form>
    </PanelSection>
  )
}
