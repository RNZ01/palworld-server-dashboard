"use client"

import type { CSSProperties } from "react"
import {
  Loader2Icon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { cn } from "@/lib/utils"

const Toaster = ({ ...props }: ToasterProps) => {
  const toastOptions = props.toastOptions

  return (
    <Sonner
      className={cn("toaster group", props.className)}
      icons={{
        info: <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />,
        success: <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />,
        warning: <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />,
        error: <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-red-400" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...toastOptions?.classNames,
          toast: cn(
            "group relative min-w-[280px] max-w-sm overflow-hidden rounded border bg-card/95 px-4 py-3 text-foreground shadow-[0_0_20px_rgba(var(--primary-rgb,0,180,255),0.06)] backdrop-blur-md",
            "before:pointer-events-none before:absolute before:inset-0 before:content-[''] before:bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.02)_2px,rgba(0,0,0,0.02)_4px)]",
            "after:pointer-events-none after:absolute after:left-0 after:top-0 after:h-1.5 after:w-1.5 after:border-l after:border-t after:border-primary/30",
            toastOptions?.classNames?.toast
          ),
          title: cn(
            "font-mono text-[10px] uppercase tracking-widest text-foreground/70",
            toastOptions?.classNames?.title
          ),
          description: cn(
            "mt-0.5 font-mono text-[9px] leading-relaxed text-foreground/40",
            toastOptions?.classNames?.description
          ),
          icon: cn("!mt-0.5 !self-start", toastOptions?.classNames?.icon),
          content: cn("!gap-0", toastOptions?.classNames?.content),
          closeButton: cn(
            "right-2 top-2 h-5 w-5 rounded border border-transparent bg-transparent text-foreground/25 opacity-100 transition-colors hover:text-foreground/55",
            toastOptions?.classNames?.closeButton
          ),
          success: cn("border-emerald-500/30", toastOptions?.classNames?.success),
          info: cn("border-primary/30", toastOptions?.classNames?.info),
          warning: cn("border-amber-500/30", toastOptions?.classNames?.warning),
          error: cn("border-red-500/30", toastOptions?.classNames?.error),
        },
      }}
      style={
        {
          "--normal-bg": "color-mix(in oklab, var(--card) 95%, transparent)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "color-mix(in oklab, var(--primary) 30%, var(--border))",
          "--border-radius": "var(--radius)",
        } as CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
