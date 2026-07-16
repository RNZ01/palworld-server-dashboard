'use client'

import { useEffect, useState } from 'react'
import { useServer } from '@/lib/server-context'
import { useTheme } from '@/lib/theme-context'
import { useTranslation } from '@/lib/i18n/i18n-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { BookOpenIcon, CheckIcon, CopyIcon, PaletteIcon, SettingsIcon } from 'lucide-react'
import { PanelSettingsDialog } from '@/components/panel-settings-dialog'
import { LanguageSwitcher } from '@/components/language-switcher'

type DashboardTab = 'dashboard' | 'map'

interface DashboardHeaderProps {
  activeTab?: DashboardTab
  onTabChange?: (tab: DashboardTab) => void
  onPlayersClick?: () => void
}

// The ONE connection truth on the dashboard view. Colors match the previous
// SignalIndicator status palette (green/amber/red).
const CONNECTION_DOT_CLASS: Record<'connected' | 'checking' | 'disconnected', string> = {
  connected: 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]',
  checking: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)] animate-pulse',
  disconnected: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)] animate-pulse',
}

const CONNECTION_TEXT_CLASS: Record<'connected' | 'checking' | 'disconnected', string> = {
  connected: 'text-green-500',
  checking: 'text-amber-500',
  disconnected: 'text-red-500',
}

export function DashboardHeader({ activeTab = 'dashboard', onTabChange, onPlayersClick }: DashboardHeaderProps) {
  const { config, clearConfig, players, connectionStatus, serverInfo } = useServer()
  const { theme, setTheme, themes } = useTheme()
  const { t } = useTranslation()
  const [addressCopied, setAddressCopied] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    if (!addressCopied) return
    const timer = window.setTimeout(() => setAddressCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [addressCopied])

  const gameAddress = config ? `${config.serverIp}:${config.gamePort}` : null

  const copyAddress = async () => {
    if (!gameAddress) return
    try {
      await navigator.clipboard.writeText(gameAddress)
      setAddressCopied(true)
    } catch {
      // Clipboard unavailable (e.g. insecure context) — address stays visible.
    }
  }

  const currentTab = activeTab

  return (
    <header>
      <div className="mx-auto w-full max-w-[1680px] px-3 pt-3 sm:px-4 sm:pt-4 lg:px-6">
        <div className="rounded border border-border/50 bg-card/50 px-3 py-2.5 backdrop-blur-sm sm:px-4">
          <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[1fr_auto_1fr] xl:items-center">
            {/* Left: identity + connection + address */}
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex min-w-0 items-baseline gap-2 font-mono">
                <span className="truncate text-sm font-bold uppercase tracking-[0.14em] text-foreground">
                  {serverInfo?.servername ?? t('header.serverFallback')}
                </span>
                {serverInfo?.version && (
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    v{serverInfo.version}
                  </span>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className={cn('status-dot h-2 w-2 rounded-full', CONNECTION_DOT_CLASS[connectionStatus])} />
                <span className={cn('font-mono text-[10px] uppercase tracking-[0.2em]', CONNECTION_TEXT_CLASS[connectionStatus])}>
                  {t(`header.status.${connectionStatus}`)}
                </span>
              </div>

              {config && gameAddress ? (
                <button
                  type="button"
                  onClick={copyAddress}
                  title={t('header.addressTitle', { game: gameAddress, rest: `${config.serverIp}:${config.restApiPort}` })}
                  className="group flex min-w-0 items-center gap-1.5 rounded border border-border/50 bg-muted/20 px-2 py-1 font-mono text-[11px] tracking-[0.08em] text-foreground/80 transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <span className="truncate">{gameAddress}</span>
                  {addressCopied ? (
                    <CheckIcon className="h-3 w-3 shrink-0 text-primary" />
                  ) : (
                    <CopyIcon className="h-3 w-3 shrink-0 text-muted-foreground group-hover:text-primary" />
                  )}
                </button>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {t('header.awaitingLink')}
                </span>
              )}
            </div>

            {/* Center: tab switcher */}
            <Tabs
              value={currentTab}
              onValueChange={(value) => onTabChange?.(value === 'map' ? 'map' : 'dashboard')}
              className="w-full sm:w-auto xl:justify-self-center"
            >
              <TabsList className="h-10 w-full rounded-md border border-border/60 bg-muted/20 sm:w-auto">
                <TabsTrigger value="dashboard" className="px-3 font-mono text-[11px] uppercase tracking-[0.2em] data-[state=active]:border-primary/60 data-[state=active]:bg-primary/10 data-[state=active]:text-primary sm:px-4">
                  {t('header.tabDashboard')}
                </TabsTrigger>
                <TabsTrigger value="map" className="px-3 font-mono text-[11px] uppercase tracking-[0.2em] data-[state=active]:border-primary/60 data-[state=active]:bg-primary/10 data-[state=active]:text-primary sm:px-4">
                  {t('header.tabMap')}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Right: theme, roster (<xl), disconnect */}
            <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto xl:justify-self-end">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 flex-1 justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] sm:flex-none"
              >
                <Link href="/docs">
                  <BookOpenIcon className="h-3.5 w-3.5" />
                  {t('header.docs')}
                </Link>
              </Button>

              <LanguageSwitcher className="flex-1 sm:flex-none" />

              {config?.accessTier === 'admin' && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSettingsOpen(true)}
                  aria-label={t('header.settingsAria')}
                  className="h-8 w-8"
                >
                  <SettingsIcon className="h-3.5 w-3.5" />
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 flex-1 justify-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] sm:flex-none"
                  >
                    <PaletteIcon className="h-3.5 w-3.5" />
                    {t('header.theme')} {themes.find((item) => item.value === theme)?.label ?? 'Tron'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {themes.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      data-selected={theme === option.value ? 'true' : 'false'}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-[0.2em]">{option.label}</span>
                        {theme === option.value && <CheckIcon className="h-3.5 w-3.5 text-primary" />}
                      </span>
                      <span className="flex items-center gap-2">
                        {theme === option.value && (
                          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">{t('header.selected')}</span>
                        )}
                        <span
                          className="status-dot h-2.5 w-2.5 rounded-full border border-white/20"
                          style={{ backgroundColor: option.accent }}
                        />
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {onPlayersClick && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPlayersClick}
                  className="h-8 flex-1 justify-center font-mono text-[11px] uppercase tracking-[0.2em] sm:flex-none xl:hidden"
                >
                  {t('header.roster')} {players.length}
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={clearConfig}
                className="no-interactive-glow h-8 flex-1 justify-center font-mono text-[11px] uppercase tracking-[0.2em] text-destructive hover:!bg-destructive hover:!text-destructive-foreground sm:flex-none"
              >
                <span>{t('header.disconnect')}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
      <PanelSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  )
}
