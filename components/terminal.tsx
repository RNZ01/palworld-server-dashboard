"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TerminalLine {
  id?: string
  text: string
  type?: "input" | "output" | "error" | "system" | "success"
  expanded?: boolean
  onClick?: () => void
}

interface TerminalProps extends React.HTMLAttributes<HTMLDivElement> {
  lines: TerminalLine[]
  title?: string
  variant?: "default" | "danger" | "locked"
  typewriter?: boolean
  fillHeight?: boolean
  hideScrollbar?: boolean
}

const linePrefix: Record<string, string> = {
  input: "> ",
  output: "  ",
  error: "! ",
  system: ":: ",
  success: "✓ ",
}

const lineColor: Record<string, string> = {
  input: "text-primary",
  output: "text-foreground/90",
  error: "text-red-500",
  system: "text-amber-500",
  success: "text-emerald-400",
}

const variantBorder: Record<string, string> = {
  default: "border-primary/50",
  danger: "border-red-500/50",
  locked: "border-amber-500/50",
}

const variantHeader: Record<string, string> = {
  default: "border-primary/30 text-primary",
  danger: "border-red-500/30 text-red-500",
  locked: "border-amber-500/30 text-amber-500",
}

export function Terminal({
  lines,
  title = "TERMINAL",
  variant = "default",
  typewriter = true,
  fillHeight = false,
  hideScrollbar = false,
  className,
  ...props
}: TerminalProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Typewriter: reveal lines one by one, then characters within each line
  const [revealedLines, setRevealedLines] = React.useState(typewriter ? 0 : lines.length)
  const [charCount, setCharCount] = React.useState(typewriter ? 0 : Infinity)

  React.useEffect(() => {
    if (!typewriter) {
      setRevealedLines(lines.length)
      setCharCount(Infinity)
      return
    }

    setRevealedLines(0)
    setCharCount(0)
    let lineIdx = 0
    let charIdx = 0
    let cancelled = false

    function typeNext() {
      if (cancelled || lineIdx >= lines.length) return

      const currentLine = lines[lineIdx]
      if (charIdx < currentLine.text.length) {
        charIdx++
        setCharCount(charIdx)
        setTimeout(typeNext, 20 + Math.random() * 20)
      } else {
        // Line complete, move to next
        lineIdx++
        charIdx = 0
        setRevealedLines(lineIdx)
        setCharCount(0)
        if (lineIdx < lines.length) {
          setTimeout(typeNext, 200 + Math.random() * 150)
        }
      }
    }

    const startTimer = setTimeout(typeNext, 400)
    return () => {
      cancelled = true
      clearTimeout(startTimer)
    }
  }, [lines, typewriter])

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [revealedLines, charCount])

  const getInteractiveProps = (line: TerminalLine) => {
    if (!line.onClick) {
      return {}
    }

    return {
      onClick: line.onClick,
      onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          line.onClick?.()
        }
      },
      role: "button" as const,
      tabIndex: 0,
    }
  }

  return (
    <div
      data-slot="tron-terminal"
      data-variant={variant}
      className={cn(
        "relative overflow-hidden rounded border bg-card/80 backdrop-blur-sm",
        fillHeight && "flex h-full min-h-0 flex-col",
        variantBorder[variant],
        className
      )}
      {...props}
    >
      {/* Scanline overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.03)_2px,rgba(0,0,0,0.03)_4px)]" />

      {/* Scan sweep */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
          style={{ animation: "terminalScan 5s ease-in-out infinite" }}
        />
      </div>

      <style jsx>{`
        @keyframes terminalScan {
          0%, 100% { top: 0%; opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          50% { top: 100%; }
        }
      `}</style>

      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 border-b px-4 py-2",
          variantHeader[variant]
        )}
      >
        <span className="text-[10px] uppercase tracking-widest text-foreground/80">
          {title}
        </span>
        {variant === "locked" && (
          <span className="ml-auto text-[10px] uppercase tracking-widest text-amber-500 animate-pulse">
            LOCKED
          </span>
        )}
      </div>

      {/* Lines */}
      <div
        ref={scrollRef}
        className={cn(
          "overflow-y-auto p-4 font-mono text-sm",
          fillHeight ? "min-h-0 flex-1" : "max-h-64",
          hideScrollbar && "scrollbar-hidden"
        )}
      >
        {lines.map((line, i) => {
          const type = line.type ?? "output"
          const interactiveProps = getInteractiveProps(line)
          const lineClasses = cn(
            "leading-relaxed whitespace-pre-wrap",
            lineColor[type],
            line.onClick && "cursor-pointer rounded px-2 py-1 transition-colors hover:bg-muted/20 focus-visible:bg-muted/20 focus-visible:outline-none",
            line.expanded && "bg-muted/15"
          )
          // Already fully revealed lines
          if (i < revealedLines) {
            return (
              <div key={line.id ?? i} className={lineClasses} {...interactiveProps}>
                <span className="opacity-60">{linePrefix[type]}</span>
                {line.text}
              </div>
            )
          }
          // Currently typing line
          if (i === revealedLines && charCount > 0) {
            return (
              <div key={line.id ?? i} className={lineClasses} {...interactiveProps}>
                <span className="opacity-60">{linePrefix[type]}</span>
                {line.text.slice(0, charCount)}
                <span className="animate-pulse text-primary">▌</span>
              </div>
            )
          }
          // Not yet revealed
          return null
        })}

        {/* Idle cursor (shown when all lines typed) */}
        {revealedLines >= lines.length && (
          <div className="inline-flex items-center leading-relaxed text-primary">
            <span className="opacity-60">{"> "}</span>
            <span className="animate-pulse">▌</span>
          </div>
        )}
      </div>

      {/* Corner decorations */}
      <div className="pointer-events-none absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-primary/50" />
      <div className="pointer-events-none absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-primary/50" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-primary/50" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-primary/50" />
    </div>
  )
}
