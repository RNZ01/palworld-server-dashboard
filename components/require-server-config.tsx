'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { LoginForm } from '@/components/login-form'
import { LoginTransition } from '@/components/login-transition'
import { LOGIN_TRANSITION_SESSION_KEY } from '@/lib/session-keys'
import { useServer } from '@/lib/server-context'

export function RequireServerConfig({ children }: { children: ReactNode }) {
  const { config, isConfigured } = useServer()
  const [showTransition, setShowTransition] = useState(false)

  useEffect(() => {
    if (!isConfigured) {
      setShowTransition(false)
      return
    }

    const shouldPlayTransition = sessionStorage.getItem(LOGIN_TRANSITION_SESSION_KEY) === '1'

    if (shouldPlayTransition) {
      sessionStorage.removeItem(LOGIN_TRANSITION_SESSION_KEY)
      setShowTransition(true)
    }
  }, [isConfigured])

  if (!isConfigured) {
    return <LoginForm />
  }

  if (showTransition) {
    return (
      <LoginTransition
        serverLabel={config ? `${config.serverIp}:${config.restApiPort}` : 'TARGET ONLINE'}
        onComplete={() => setShowTransition(false)}
      />
    )
  }

  return <>{children}</>
}
