'use client'

import { useEffect, useMemo, useState } from 'react'
import { useServer } from '@/lib/server-context'
import { Button } from '@/components/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { buildPalworldApiUrl } from '@/lib/palworld'
import { LOGIN_TRANSITION_SESSION_KEY } from '@/lib/session-keys'
import { InfoPanel, StatusBar } from '@/components/status-bar'
import { Terminal } from '@/components/terminal'
import { ServerIcon, KeyIcon, NetworkIcon, Loader2Icon, CheckCircle2Icon, XCircleIcon } from 'lucide-react'
import type { ServerConfig } from '@/lib/types'

const SERVER_CONFIG_STORAGE_KEY = 'serverConfig'
const VALIDATION_DEBOUNCE_MS = 500
const VALIDATION_REQUEST_TIMEOUT_MS = 5_000

type ValidationState = 'idle' | 'checking' | 'valid' | 'invalid'

interface LoginConfigPayload {
  serverIp: string
  restApiPort: string
  adminPassword: string
}

function toFriendlyValidationMessage(rawMessage: string, config: LoginConfigPayload) {
  const message = rawMessage.trim()
  const target = `${config.serverIp}:${config.restApiPort}`

  if (!message) {
    return `Could not validate the server connection. Check host (${target}), REST API port, and admin password.`
  }

  if (/fetch failed|failed to fetch/i.test(message)) {
    return `Cannot reach the REST API at ${target}. Check the IP/URL and REST API port, then make sure the server is online and reachable through firewall/network rules.`
  }

  if (/401|unauthorized|forbidden/i.test(message)) {
    return 'Authentication failed. Check the admin password and confirm REST API authentication is enabled on the server.'
  }

  if (/enotfound|eai_again|getaddrinfo|resolve/i.test(message)) {
    return `Host "${config.serverIp}" could not be resolved. Check for typos in the IP/URL or a DNS issue.`
  }

  if (/econnrefused|refused/i.test(message)) {
    return `Connection was refused at ${target}. Confirm the REST API port is correct and the server is listening on that port.`
  }

  if (/etimedout|timed out|timeout/i.test(message)) {
    return `Connection to ${target} timed out. Check network reachability, firewall rules, and that the server is running.`
  }

  return message
}

async function getApiErrorMessage(response: Response, fallbackMessage: string) {
  try {
    const data = await response.json() as { error?: string }
    return data.error || fallbackMessage
  } catch {
    return fallbackMessage
  }
}

async function validateServerAndGamePort(config: LoginConfigPayload, signal?: AbortSignal) {
  const requestController = new AbortController()
  const timeoutId = window.setTimeout(() => {
    requestController.abort()
  }, VALIDATION_REQUEST_TIMEOUT_MS)

  const handleExternalAbort = () => {
    requestController.abort()
  }

  if (signal) {
    if (signal.aborted) {
      requestController.abort()
    } else {
      signal.addEventListener('abort', handleExternalAbort, { once: true })
    }
  }

  let infoResponse: Response

  try {
    infoResponse = await fetch(buildPalworldApiUrl(config, 'info'), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: requestController.signal,
    })
  } catch (error) {
    if (requestController.signal.aborted && !signal?.aborted) {
      throw new Error(`Validation timed out after ${VALIDATION_REQUEST_TIMEOUT_MS / 1000} seconds.`)
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
    signal?.removeEventListener('abort', handleExternalAbort)
  }

  if (!infoResponse.ok) {
    throw new Error(await getApiErrorMessage(infoResponse, 'Failed to connect to server'))
  }
}

export function LoginForm() {
  const { setConfig } = useServer()
  const [serverIp, setServerIp] = useState('')
  const [restApiPort, setRestApiPort] = useState('8212')
  const [gamePort, setGamePort] = useState('8211')
  const [adminPassword, setAdminPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState('')
  const [validationState, setValidationState] = useState<ValidationState>('idle')
  const [validationMessage, setValidationMessage] = useState('')

  const inputValidationClass =
    validationState === 'valid'
      ? 'border-green-500/70 focus-visible:border-green-500 focus-visible:ring-green-500/35'
      : validationState === 'invalid'
        ? 'border-destructive/70 focus-visible:border-destructive focus-visible:ring-destructive/35'
        : ''

  const [bootValidationLines, setBootValidationLines] = useState<
    Array<{ id: string; text: string; type: 'system' | 'success' | 'error' }>
  >([])

  useEffect(() => {
    if (validationState === 'idle') {
      return
    }

    const nextLine =
      validationState === 'checking'
        ? {
            text: 'LIVE VALIDATION: CHECKING HOST, REST PORT, AND ADMIN PASSWORD',
            type: 'system' as const,
          }
        : validationState === 'valid'
          ? {
              text: 'LIVE VALIDATION: PASS. CREDENTIALS VERIFIED.',
              type: 'success' as const,
            }
          : {
              text: `LIVE VALIDATION: FAILED. ${validationMessage.toUpperCase()}`,
              type: 'error' as const,
            }

    setBootValidationLines((previous) => {
      const lastLine = previous[previous.length - 1]
      if (lastLine && lastLine.text === nextLine.text && lastLine.type === nextLine.type) {
        return previous
      }

      const next = [
        ...previous,
        {
          id: `validation-${Date.now()}-${validationState}`,
          text: nextLine.text,
          type: nextLine.type,
        },
      ]

      return next.slice(-8)
    })
  }, [validationMessage, validationState])

  const bootSequenceLines = useMemo(
    () => [
      { text: 'INITIALIZING ADMIN INTERFACE', type: 'system' as const },
      { text: 'LOADING SERVER LINK PROTOCOLS', type: 'output' as const },
      { text: 'VERIFY PALWORLD REST ENDPOINT', type: 'output' as const },
      { text: 'LIVE VALIDATION MONITOR ARMED', type: 'system' as const },
      { text: 'AWAITING OPERATOR CREDENTIALS', type: 'input' as const },
      ...bootValidationLines,
    ],
    [bootValidationLines]
  )

  useEffect(() => {
    const storedConfigRaw = localStorage.getItem(SERVER_CONFIG_STORAGE_KEY)
    if (!storedConfigRaw) {
      return
    }

    try {
      const parsed = JSON.parse(storedConfigRaw) as Partial<ServerConfig>
      setServerIp(String(parsed.serverIp ?? '').trim())
      setRestApiPort(String(parsed.restApiPort ?? '8212').trim() || '8212')
      setGamePort(String(parsed.gamePort ?? '8211').trim() || '8211')
      setAdminPassword(String(parsed.adminPassword ?? ''))
      setRememberMe(true)
    } catch {
      // Ignore malformed saved config
    }
  }, [])

  useEffect(() => {
    const normalizedConfig = {
      serverIp: serverIp.trim(),
      restApiPort: restApiPort.trim(),
      adminPassword,
    }

    const isReadyForValidation =
      normalizedConfig.serverIp.length > 0 &&
      normalizedConfig.restApiPort.length > 0 &&
      normalizedConfig.adminPassword.length > 0

    if (!isReadyForValidation) {
      setValidationState('idle')
      setValidationMessage('')
      return
    }

    const controller = new AbortController()
    const timeout = window.setTimeout(async () => {
      setValidationState('checking')
      setValidationMessage('Validating server credentials...')

      try {
        await validateServerAndGamePort(normalizedConfig, controller.signal)

        setValidationState('valid')
        setValidationMessage('Live validation passed: host, REST API port, and admin password are verified.')
      } catch (err) {
        if (controller.signal.aborted) {
          return
        }

        const rawMessage = err instanceof Error ? err.message : 'Validation failed'
        const message = toFriendlyValidationMessage(rawMessage, normalizedConfig)
        setValidationState('invalid')
        setValidationMessage(message)
      }
    }, VALIDATION_DEBOUNCE_MS)

    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [serverIp, restApiPort, adminPassword])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsConnecting(true)

    const normalizedConfig = {
      serverIp: serverIp.trim(),
      restApiPort: restApiPort.trim(),
      gamePort: gamePort.trim(),
      adminPassword,
    }

    if (!normalizedConfig.serverIp || !normalizedConfig.restApiPort || !normalizedConfig.gamePort || !normalizedConfig.adminPassword) {
      setError('All fields are required')
      setIsConnecting(false)
      return
    }

    try {
      await validateServerAndGamePort(normalizedConfig)

      sessionStorage.setItem(LOGIN_TRANSITION_SESSION_KEY, '1')
      setConfig(normalizedConfig, { rememberMe })
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'Unknown error'
      const message = toFriendlyValidationMessage(rawMessage, normalizedConfig)
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
        />

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Terminal
            title="BOOT SEQUENCE"
            lines={bootSequenceLines}
            typewriter={false}
            fillHeight
            hideScrollbar
            className="hidden min-h-[520px] xl:flex"
          />

          <InfoPanel
            title="Palworld Server Admin"
            subtitle="REST Link Authentication"
            status="active"
            className="w-full border-border/60 bg-card/80"
          >
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="login-avatar-shell mx-auto">
                <div className="login-avatar-ring" />
                <div className="login-avatar-core overflow-hidden rounded-xl border border-primary/20 bg-primary/10">
                  <img src="/login-mascot.jpg" alt="Pal mascot" className="login-avatar-image h-full w-full object-cover" />
                </div>
                <div className="login-avatar-spark" />
              </div>
              <p className="mt-4 max-w-md text-sm text-muted-foreground">
                Connect to your Palworld server REST API and bring the control grid online.
              </p>
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
              <form onSubmit={handleSubmit} className="space-y-6" autoComplete="on" data-1p-ignore="false">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="serverIp">Server IP or URL</FieldLabel>
                    <div className="relative">
                      <NetworkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white" />
                      <Input
                        id="serverIp"
                        name="serverIp"
                        type="text"
                        autoComplete="url"
                        placeholder="192.168.1.100 or play.example.com"
                        value={serverIp}
                        onChange={(e) => setServerIp(e.target.value)}
                        required
                        className={`pl-10 ${inputValidationClass}`}
                      />
                    </div>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="restApiPort">REST API Port</FieldLabel>
                    <div className="relative">
                      <ServerIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white" />
                      <Input
                        id="restApiPort"
                        name="restApiPort"
                        type="text"
                        autoComplete="off"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-lpignore="true"
                        placeholder="8212"
                        value={restApiPort}
                        onChange={(e) => setRestApiPort(e.target.value)}
                        required
                        className={`pl-10 ${inputValidationClass}`}
                      />
                    </div>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="gamePort">Game Port</FieldLabel>
                    <div className="relative">
                      <ServerIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white" />
                      <Input
                        id="gamePort"
                        name="gamePort"
                        type="text"
                        autoComplete="off"
                        data-1p-ignore="true"
                        data-bwignore="true"
                        data-lpignore="true"
                        placeholder="8211"
                        value={gamePort}
                        onChange={(e) => setGamePort(e.target.value)}
                        required
                        className={`pl-10 ${inputValidationClass}`}
                      />
                    </div>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="adminPassword">Admin Password</FieldLabel>
                    <div className="relative">
                      <KeyIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white" />
                      <Input
                        id="adminPassword"
                        name="adminPassword"
                        type="password"
                        autoComplete="current-password"
                        placeholder="Enter admin password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        required
                        className={`pl-10 ${inputValidationClass}`}
                      />
                    </div>
                  </Field>
                </FieldGroup>

                {error && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                  <div>
                    <label htmlFor="rememberMe" className="text-sm font-medium text-foreground">Remember me</label>
                    <p className="text-xs text-muted-foreground">Save server IP, ports, and admin password on this device.</p>
                  </div>
                  <Switch
                    id="rememberMe"
                    name="rememberMe"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-lpignore="true"
                    checked={rememberMe}
                    onCheckedChange={setRememberMe}
                    aria-label="Remember login data"
                  />
                </div>

                <div className="h-14">
                  <div
                    className={`flex h-full items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                      validationState === 'valid'
                        ? 'border-green-500/40 bg-green-500/10 text-green-400'
                        : validationState === 'invalid'
                          ? 'border-destructive/40 bg-destructive/10 text-destructive'
                          : validationState === 'checking'
                            ? 'border-border/60 bg-muted/20 text-muted-foreground'
                            : 'border-border/30 bg-muted/10 text-muted-foreground/60 opacity-0'
                    }`}
                    aria-live="polite"
                  >
                    {validationState === 'checking' ? (
                      <Loader2Icon className="h-3.5 w-3.5 shrink-0 animate-spin" />
                    ) : validationState === 'valid' ? (
                      <CheckCircle2Icon className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <XCircleIcon className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="line-clamp-2 flex-1 text-center leading-relaxed">
                      {validationState === 'idle' ? 'VALIDATION STATUS PLACEHOLDER' : validationMessage}
                    </span>
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="default"
                  size="default"
                  className="h-9 w-full rounded-md border border-[#00d4ff]/80 bg-[#071526] font-mono text-[11px] tracking-[0.16em] text-[#00d4ff] uppercase shadow-none transition-colors hover:bg-[#0b213d] hover:text-[#00d4ff] focus-visible:ring-[#00d4ff]/45"
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
