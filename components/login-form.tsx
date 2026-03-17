'use client'

import { useState } from 'react'
import { useServer } from '@/lib/server-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { buildPalworldApiUrl } from '@/lib/palworld'
import { LOGIN_TRANSITION_SESSION_KEY } from '@/lib/session-keys'
import { InfoPanel, StatusBar } from '@/components/status-bar'
import { Terminal } from '@/components/terminal'
import { ServerIcon, KeyIcon, NetworkIcon, Loader2Icon } from 'lucide-react'

export function LoginForm() {
  const { setConfig } = useServer()
  const [serverIp, setServerIp] = useState('')
  const [restApiPort, setRestApiPort] = useState('8212')
  const [adminPassword, setAdminPassword] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsConnecting(true)

    const normalizedConfig = {
      serverIp: serverIp.trim(),
      restApiPort: restApiPort.trim(),
      adminPassword,
    }

    if (!normalizedConfig.serverIp || !normalizedConfig.restApiPort || !normalizedConfig.adminPassword) {
      setError('All fields are required')
      setIsConnecting(false)
      return
    }

    try {
      const response = await fetch(buildPalworldApiUrl(normalizedConfig, 'info'), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to connect to server')
      }

      sessionStorage.setItem(LOGIN_TRANSITION_SESSION_KEY, '1')
      setConfig(normalizedConfig)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to connect: ${message}`)
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col justify-center gap-4">
        <StatusBar
          variant="info"
          leftContent={
            <>
              <span>PALWORLD CONTROL GRID</span>
              <span>AUTHENTICATION REQUIRED</span>
            </>
          }
          rightContent={
            <>
              <span>REST LINK</span>
              <span>READY</span>
            </>
          }
        />

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Terminal
            title="BOOT SEQUENCE"
            lines={[
              { text: 'INITIALIZING ADMIN INTERFACE', type: 'system' },
              { text: 'LOADING SERVER LINK PROTOCOLS', type: 'output' },
              { text: 'VERIFY PALWORLD REST ENDPOINT', type: 'output' },
              { text: 'AWAITING OPERATOR CREDENTIALS', type: 'input' },
            ]}
            className="hidden min-h-[520px] xl:block"
          />

          <InfoPanel
            title="Palworld Server Admin"
            subtitle="REST Link Authentication"
            status="active"
            className="w-full border-border/60 bg-card/80"
          >
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                <ServerIcon className="h-8 w-8 text-primary" />
              </div>
              <p className="mt-4 max-w-md text-sm text-muted-foreground">
                Connect to your Palworld server REST API and bring the control grid online.
              </p>
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
              <form onSubmit={handleSubmit} className="space-y-6">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="serverIp">Server IP Address</FieldLabel>
                    <div className="relative">
                      <NetworkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="serverIp"
                        type="text"
                        placeholder="192.168.1.100"
                        value={serverIp}
                        onChange={(e) => setServerIp(e.target.value)}
                        className="pl-10 bg-input border-border"
                      />
                    </div>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="restApiPort">REST API Port</FieldLabel>
                    <div className="relative">
                      <ServerIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="restApiPort"
                        type="text"
                        placeholder="8212"
                        value={restApiPort}
                        onChange={(e) => setRestApiPort(e.target.value)}
                        className="pl-10 bg-input border-border"
                      />
                    </div>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="adminPassword">Admin Password</FieldLabel>
                    <div className="relative">
                      <KeyIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="adminPassword"
                        type="password"
                        placeholder="Enter admin password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="pl-10 bg-input border-border"
                      />
                    </div>
                  </Field>
                </FieldGroup>

                {error && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    'Connect to Server'
                  )}
                </Button>
              </form>
            </div>
          </InfoPanel>
        </div>
      </div>
    </div>
  )
}
