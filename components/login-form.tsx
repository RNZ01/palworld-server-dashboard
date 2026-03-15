'use client'

import { useState } from 'react'
import { useServer } from '@/lib/server-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
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

    // Validate inputs
    if (!serverIp || !restApiPort || !adminPassword) {
      setError('All fields are required')
      setIsConnecting(false)
      return
    }

    // Try to connect to the server
    try {
      const response = await fetch(`http://${serverIp}:${restApiPort}/v1/api/info`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Basic ${btoa(`admin:${adminPassword}`)}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to connect to server')
      }

      // Connection successful, save config
      setConfig({ serverIp, restApiPort, adminPassword })
    } catch {
      setError('Failed to connect. Check your server IP, port, and password.')
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
            <ServerIcon className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-foreground">Palworld Server Admin</CardTitle>
            <CardDescription className="text-muted-foreground">
              Connect to your Palworld server REST API
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="serverIp">Server IP Address</FieldLabel>
                <div className="relative">
                  <NetworkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
                  <ServerIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
                  <KeyIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
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
                  <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect to Server'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
