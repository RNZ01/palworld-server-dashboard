"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface DataStreamEntry {
  id?: string
  timestamp?: string
  text: string
  type?: "info" | "warning" | "error" | "success"
  onClick?: () => void
  expanded?: boolean
}

interface DataStreamProps extends React.HTMLAttributes<HTMLDivElement> {
  entries: DataStreamEntry[]
  title?: string
  maxVisible?: number
  streaming?: boolean
}

const typeColor: Record<string, string> = {
  info: "text-primary",
  warning: "text-amber-500",
  error: "text-red-500",
  success: "text-green-500",
}

const typeDot: Record<string, string> = {
  info: "bg-primary",
  warning: "bg-amber-500",
  error: "bg-red-500",
  success: "bg-green-500",
}

export function DataStream({
  entries,
  title = "DATA STREAM",
  maxVisible = 8,
  streaming = true,
  className,
  ...props
}: DataStreamProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [visibleCount, setVisibleCount] = React.useState(0)
  const previousLengthRef = React.useRef(0)
  const visibleCountRef = React.useRef(0)
  const revealTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  React.useEffect(() => {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current)
      revealTimerRef.current = null
    }

    const previousLength = previousLengthRef.current
    const nextLength = entries.length

    // Initial reveal for first render.
    if (previousLength === 0 && visibleCountRef.current === 0 && nextLength > 0) {
      let count = 0
      revealTimerRef.current = setInterval(() => {
        count += 1
        visibleCountRef.current = count
        setVisibleCount(count)
        if (count >= nextLength && revealTimerRef.current) {
          clearInterval(revealTimerRef.current)
          revealTimerRef.current = null
        }
      }, 300)
      previousLengthRef.current = nextLength
      return () => {
        if (revealTimerRef.current) {
          clearInterval(revealTimerRef.current)
          revealTimerRef.current = null
        }
      }
    }

    // New rows appended: animate only the delta.
    if (nextLength > previousLength) {
      let count = Math.max(visibleCountRef.current, previousLength)
      visibleCountRef.current = count
      setVisibleCount(count)

      revealTimerRef.current = setInterval(() => {
        count += 1
        visibleCountRef.current = count
        setVisibleCount(count)
        if (count >= nextLength && revealTimerRef.current) {
          clearInterval(revealTimerRef.current)
          revealTimerRef.current = null
        }
      }, 300)

      previousLengthRef.current = nextLength
      return () => {
        if (revealTimerRef.current) {
          clearInterval(revealTimerRef.current)
          revealTimerRef.current = null
        }
      }
    }

    // Rows cleared/trimmed: clamp immediately without replaying the animation.
    visibleCountRef.current = nextLength
    setVisibleCount(nextLength)
    previousLengthRef.current = nextLength

    return () => {
      if (revealTimerRef.current) {
        clearInterval(revealTimerRef.current)
        revealTimerRef.current = null
      }
    }
  }, [entries.length])

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [visibleCount])

  return (
    <div
      data-slot="tron-data-stream"
      className={cn(
        "relative overflow-hidden rounded border border-primary/30 bg-card/80 backdrop-blur-sm",
        className
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)]" />

      <div className="relative z-10 flex items-center gap-2 border-b border-border/50 px-4 py-2">
        {streaming && (
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]" />
        )}
        <span className="text-[10px] uppercase tracking-widest text-foreground/80">
          {title}
        </span>
        <span className="ml-auto font-mono text-[10px] text-foreground/40">
          {visibleCount}/{entries.length}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="relative z-10 overflow-y-auto font-mono text-xs"
        style={{ maxHeight: maxVisible * 28 }}
      >
        {entries.slice(0, visibleCount).map((entry, i) => {
          const type = entry.type ?? "info"
          return (
            <div
              key={entry.id ?? i}
              className={cn(
                "flex items-start gap-2 border-b border-border/20 px-4 py-1.5",
                entry.onClick && "cursor-pointer transition-colors hover:bg-primary/8",
                entry.expanded && "bg-primary/5"
              )}
              style={{ animation: "dataStreamFadeIn 0.3s ease-out" }}
              onClick={entry.onClick}
              onKeyDown={(event) => {
                if (!entry.onClick) return
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  entry.onClick()
                }
              }}
              role={entry.onClick ? "button" : undefined}
              tabIndex={entry.onClick ? 0 : undefined}
            >
              <div className={cn("mt-1.5 h-1 w-1 shrink-0 rounded-full", typeDot[type])} />
              {entry.timestamp && (
                <span className="shrink-0 text-foreground/40">{entry.timestamp}</span>
              )}
              <span className={cn("leading-relaxed whitespace-pre-wrap", typeColor[type])}>{entry.text}</span>
            </div>
          )
        })}
      </div>

      <style jsx>{`
        @keyframes dataStreamFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="pointer-events-none absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-primary/50" />
      <div className="pointer-events-none absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-primary/50" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-primary/50" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-primary/50" />
    </div>
  )
}
