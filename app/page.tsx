'use client'

import { ServerProvider, useServer } from '@/lib/server-context'
import { LoginForm } from '@/components/login-form'
import { Dashboard } from '@/components/dashboard'
import { Toaster } from '@/components/ui/sonner'

function AppContent() {
  const { isConfigured } = useServer()

  if (!isConfigured) {
    return <LoginForm />
  }

  return <Dashboard />
}

export default function Home() {
  return (
    <ServerProvider>
      <AppContent />
      <Toaster 
        position="top-right" 
        theme="dark"
        toastOptions={{
          style: {
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))',
          },
        }}
      />
    </ServerProvider>
  )
}
