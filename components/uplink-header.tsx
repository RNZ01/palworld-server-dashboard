"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface UplinkHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  leftText: string
  rightText?: string
  variant?: "primary" | "cyan" | "orange" | "blue" | "purple" | "green" | "amber"
}

const variantStyles = {
  primary: { border: "border-primary/30", bg: "bg-primary/5", text: "text-primary", textMuted: "text-primary" },
  cyan: { border: "border-cyan-500/30", bg: "bg-cyan-500/5", text: "text-cyan-400", textMuted: "text-cyan-400" },
  orange: { border: "border-orange-500/30", bg: "bg-orange-500/5", text: "text-orange-400", textMuted: "text-orange-400" },
  blue: { border: "border-blue-500/30", bg: "bg-blue-500/5", text: "text-blue-400", textMuted: "text-blue-400" },
  purple: { border: "border-purple-500/30", bg: "bg-purple-500/5", text: "text-purple-400", textMuted: "text-purple-400" },
  green: { border: "border-green-500/30", bg: "bg-green-500/5", text: "text-green-400", textMuted: "text-green-400" },
  amber: { border: "border-amber-500/30", bg: "bg-amber-500/5", text: "text-amber-400", textMuted: "text-amber-400" },
}

export function UplinkHeader({
  leftText,
  rightText,
  variant = "primary",
  className,
  ...props
}: UplinkHeaderProps) {
  const styles = variantStyles[variant]

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-y px-3 py-1.5 font-mono text-[10px] tracking-[0.18em] sm:px-4 sm:tracking-widest",
        styles.border,
        styles.bg,
        className
      )}
      {...props}
    >
      <span className={cn(styles.text, "min-w-0 truncate")}>{leftText}</span>
      {rightText && <span className={cn(styles.textMuted, "max-w-[55%] truncate text-right")}>{rightText}</span>}
    </div>
  )
}
