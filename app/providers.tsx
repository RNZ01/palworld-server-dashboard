'use client'

import type { ReactNode } from 'react'
import { ServerProvider } from '@/lib/server-context'
import { ThemeProvider } from '@/lib/theme-context'
import { Toaster } from '@/components/ui/sonner'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <ServerProvider>
        {children}
        <Toaster
          position="bottom-center"
          theme="dark"
          className="!bottom-20 sm:!bottom-4 sm:!right-4 sm:!left-auto"
          toastOptions={{
            style: {
              background: 'oklch(0.17 0.01 250)',
              border: '1px solid oklch(0.28 0.01 250)',
              color: 'oklch(0.95 0 0)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            },
            classNames: {
              toast: '!bg-card !border-border !text-foreground',
              title: '!text-foreground',
              description: '!text-muted-foreground',
              success: '!bg-card !border-primary/30',
              error: '!bg-card !border-destructive/30',
              info: '!bg-card !border-border',
            },
          }}
        />
      </ServerProvider>
    </ThemeProvider>
  )
}
