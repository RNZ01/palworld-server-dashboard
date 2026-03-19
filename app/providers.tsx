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
          position="top-right"
          theme="dark"
          className="!bottom-20 !top-auto !left-1/2 !-translate-x-1/2 sm:!top-4 sm:!right-4 sm:!bottom-auto sm:!left-auto sm:!translate-x-0"
        />
      </ServerProvider>
    </ThemeProvider>
  )
}
