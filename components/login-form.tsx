'use client'

import { useEffect, useMemo, useState } from 'react'
import { useServer } from '@/lib/server-context'
import { Button } from '@/components/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import { buildPalworldProxyHeaders, buildPalworldProxyPath } from '@/lib/palworld'
import { demoConfig } from '@/lib/demo'
import { LOGIN_TRANSITION_SESSION_KEY } from '@/lib/session-keys'
import { InfoPanel, StatusBar } from '@/components/status-bar'
import { Terminal } from '@/components/terminal'
import { LanguageSwitcher } from '@/components/language-switcher'
import { useTranslation } from '@/lib/i18n/i18n-context'
import { KeyIcon, Loader2Icon, CheckCircle2Icon, XCircleIcon } from 'lucide-react'
import type { AccessTier, ServerConfig } from '@/lib/types'

const SERVER_CONFIG_STORAGE_KEY = 'serverConfig'
const VALIDATION_DEBOUNCE_MS = 500
const VALIDATION_REQUEST_TIMEOUT_MS = 5_000

// When the panel is exposed to the internet, the proxy pins the upstream REST
// target server-side (PALWORLD_REST_URL). These address values are kept
// only so the stored config stays well-formed and the header/context display
// keeps working — the proxy ignores them and always talks to the pinned upstream.
const PINNED_SERVER_IP = '127.0.0.1'
const PINNED_REST_API_PORT = '8212'
const PINNED_GAME_PORT = '8211'

type ValidationState = 'idle' | 'checking' | 'valid' | 'invalid'
type TranslateFn = (path: string, params?: Record<string, string | number>) => string

interface LoginConfigPayload {
  serverIp: string
  restApiPort: string
  adminPassword: string
}

// Maps a raw error string (from fetch or the REST proxy) to a friendly,
// localized message. `t` is passed in because this runs outside the component.
function toFriendlyValidationMessage(rawMessage: string, t: TranslateFn) {
  const message = rawMessage.trim()

  if (!message) {
    return t('login.errCouldNotVerify')
  }

  if (/401|unauthorized|forbidden/i.test(message)) {
    return t('login.errAuthFailed')
  }

  if (/fetch failed|failed to fetch|econnrefused|refused/i.test(message)) {
    return t('login.errUnreachable')
  }

  if (/etimedout|timed out|timeout/i.test(message)) {
    return t('login.errTimeout')
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

async function validateServerConnection(config: LoginConfigPayload, t: TranslateFn, signal?: AbortSignal) {
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
    infoResponse = await fetch(buildPalworldProxyPath('info'), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...buildPalworldProxyHeaders(config),
      },
      cache: 'no-store',
      signal: requestController.signal,
    })
  } catch (error) {
    if (requestController.signal.aborted && !signal?.aborted) {
      throw new Error(t('login.errValidationTimeout', { seconds: VALIDATION_REQUEST_TIMEOUT_MS / 1000 }))
    }

    throw error
  } finally {
    window.clearTimeout(timeoutId)
    signal?.removeEventListener('abort', handleExternalAbort)
  }

  if (!infoResponse.ok) {
    throw new Error(await getApiErrorMessage(infoResponse, t('login.errFailedConnect')))
  }
}

// Resolve the panel access tier for the entered password. Passwords are only
// compared server-side; the response carries the tier and nothing else.
async function fetchAccessTier(password: string): Promise<AccessTier | 'invalid'> {
  try {
    const response = await fetch('/api/auth-tier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      cache: 'no-store',
    })

    if (!response.ok) {
      return 'invalid'
    }

    const data = (await response.json()) as { tier?: unknown }
    return data.tier === 'admin' || data.tier === 'mod' ? data.tier : 'invalid'
  } catch {
    return 'invalid'
  }
}

export function LoginForm() {
  const { t } = useTranslation()
  const { setConfig } = useServer()
  const [adminPassword, setAdminPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDemoMode, setIsDemoMode] = useState(false)
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
            text: t('login.boot.checking'),
            type: 'system' as const,
          }
        : validationState === 'valid'
          ? {
              text: t('login.boot.verified'),
              type: 'success' as const,
            }
          : {
              text: t('login.boot.failed', { msg: validationMessage.toUpperCase() }),
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
  }, [validationMessage, validationState, t])

  const bootSequenceLines = useMemo(
    () => [
      { text: t('login.boot.init'), type: 'system' as const },
      { text: t('login.boot.loadProtocols'), type: 'output' as const },
      { text: t('login.boot.verifyEndpoint'), type: 'output' as const },
      { text: t('login.boot.monitorArmed'), type: 'system' as const },
      { text: t('login.boot.awaitingPassword'), type: 'input' as const },
      ...bootValidationLines,
    ],
    [bootValidationLines, t]
  )

  useEffect(() => {
    void fetch('/api/demo-mode', { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ enabled?: boolean }>)
      .then((data) => setIsDemoMode(Boolean(data.enabled)))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const storedConfigRaw = localStorage.getItem(SERVER_CONFIG_STORAGE_KEY)
    if (!storedConfigRaw) {
      return
    }

    try {
      // Only the password is restored into the form now; the address values are
      // pinned constants applied at submit, so a saved config that predates the
      // password-only login (or lacks the address fields) still restores cleanly.
      const parsed = JSON.parse(storedConfigRaw) as Partial<ServerConfig>
      setAdminPassword(String(parsed.adminPassword ?? ''))
      setRememberMe(true)
    } catch {
      // Ignore malformed saved config
    }
  }, [])

  useEffect(() => {
    const normalizedConfig = {
      serverIp: PINNED_SERVER_IP,
      restApiPort: PINNED_REST_API_PORT,
      adminPassword,
    }

    // LOCAL-only readiness (fixed 2026-07-10): previously this probed /info on
    // every keystroke, and each wrong-password probe hit the server-side
    // brute-force limiter — so merely TYPING burned failures and locked users
    // out in ~1 attempt. No network here now; real auth happens on submit.
    if (normalizedConfig.adminPassword.length === 0) {
      setValidationState('idle')
      setValidationMessage('')
    } else {
      setValidationState('idle')
      setValidationMessage(t('login.pressConnect'))
    }
  }, [adminPassword, t])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsConnecting(true)

    // Address values are pinned constants (display/compat only) — the proxy
    // ignores them and talks to the server-side PALWORLD_REST_URL upstream.
    const normalizedConfig = {
      serverIp: PINNED_SERVER_IP,
      restApiPort: PINNED_REST_API_PORT,
      gamePort: PINNED_GAME_PORT,
      adminPassword,
    }

    if (isDemoMode) {
      sessionStorage.setItem(LOGIN_TRANSITION_SESSION_KEY, '1')
      setConfig(demoConfig, { rememberMe: false })
      setIsConnecting(false)
      return
    }

    if (!normalizedConfig.adminPassword) {
      setError(t('login.errPasswordRequired'))
      setIsConnecting(false)
      return
    }

    try {
      await validateServerConnection(normalizedConfig, t)

      // validateServerConnection succeeded, so the password is live. Resolve
      // which tier it authenticated as; 'invalid' at this point means a
      // directly-entered real game credential the panel env does not list —
      // that keeps full admin access (passthrough), same as before.
      const tierResult = await fetchAccessTier(normalizedConfig.adminPassword)
      const accessTier: AccessTier = tierResult === 'mod' ? 'mod' : 'admin'

      sessionStorage.setItem(LOGIN_TRANSITION_SESSION_KEY, '1')
      setConfig({ ...normalizedConfig, accessTier }, { rememberMe })
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : t('login.errUnknown')
      const message = toFriendlyValidationMessage(rawMessage, t)
      setError(message)
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className="relative min-h-screen p-4 sm:p-6">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <LanguageSwitcher />
      </div>
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col justify-center gap-4">
        <StatusBar
          variant="info"
          leftContent={
            <>
              <span>{t('login.controlGrid')}</span>
              <span>{t('login.authRequired')}</span>
            </>
          }
        />

        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Terminal
            title={t('login.bootTitle')}
            lines={bootSequenceLines}
            typewriter={false}
            fillHeight
            hideScrollbar
            className="hidden min-h-[520px] xl:flex"
          />

          <InfoPanel
            title={t('login.adminTitle')}
            subtitle={t('login.adminSubtitle')}
            status="active"
            className="w-full border-border/60 bg-card/80"
          >
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="login-avatar-shell mx-auto">
                <div className="login-avatar-ring avatar-circle" />
                <div className="login-avatar-core avatar-circle overflow-hidden rounded-xl border border-primary/20 bg-primary/10">
                  <img src="/login-mascot.jpg" alt={t('login.mascotAlt')} className="login-avatar-image h-full w-full object-cover" />
                </div>
                <div className="login-avatar-spark" />
              </div>
              <p className="mt-4 max-w-md text-sm text-muted-foreground">
                {isDemoMode ? t('login.demoIntro') : t('login.intro')}
              </p>
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
              <form onSubmit={handleSubmit} className="space-y-6" autoComplete="on" data-1p-ignore="false">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="adminPassword">{t('login.passwordLabel')}</FieldLabel>
                    <div className="relative">
                      <KeyIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white" />
                      <Input
                        id="adminPassword"
                        name="adminPassword"
                        type="password"
                        autoComplete="current-password"
                        placeholder={isDemoMode ? t('login.passwordPlaceholderDemo') : t('login.passwordPlaceholder')}
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        required={!isDemoMode}
                        disabled={isDemoMode}
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
                    <label htmlFor="rememberMe" className="text-sm font-medium text-foreground">{t('login.rememberMe')}</label>
                    <p className="text-xs text-muted-foreground">{t('login.rememberMeHint')}</p>
                  </div>
                  <Switch
                    id="rememberMe"
                    name="rememberMe"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-lpignore="true"
                    checked={rememberMe}
                    onCheckedChange={setRememberMe}
                    aria-label={t('login.rememberAria')}
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
                      {validationState === 'idle' ? t('login.validationPlaceholder') : validationMessage}
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
                      {t('login.connecting')}
                    </>
                  ) : isDemoMode ? (
                    t('login.launchDemo')
                  ) : (
                    t('login.connectButton')
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
