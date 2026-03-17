'use client'

import { useEffect, useMemo, useState } from 'react'
import { HUDCornerFrame } from '@/components/hud-corner-frame'
import { IdentityDisc } from '@/components/identity-disc'
import { InfoPanel, ProgressTimeline, StatusBar } from '@/components/status-bar'
import { SignalIndicator } from '@/components/signal-indicator'
import { Terminal } from '@/components/terminal'
import { UplinkHeader } from '@/components/uplink-header'

const TRANSITION_DURATION_MS = 2600

interface LoginTransitionProps {
  serverLabel: string
  onComplete: () => void
}

export function LoginTransition({ serverLabel, onComplete }: LoginTransitionProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const startTime = Date.now()

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startTime
      const nextProgress = Math.min(100, (elapsed / TRANSITION_DURATION_MS) * 100)
      setProgress(nextProgress)
    }, 32)

    const timeout = window.setTimeout(() => {
      setProgress(100)
      onComplete()
    }, TRANSITION_DURATION_MS)

    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timeout)
    }
  }, [onComplete])

  const terminalLines = useMemo(() => ([
    { text: 'AUTH TOKEN ACCEPTED', type: 'success' as const },
    { text: `TARGET UPLINK RESOLVED :: ${serverLabel.toUpperCase()}`, type: 'system' as const },
    { text: 'SYNCING CONTROL SURFACES', type: 'output' as const },
    { text: 'WARMING LIVE METRICS CACHE', type: 'output' as const },
    { text: 'MOUNTING COMMAND GRID', type: 'input' as const },
  ]), [serverLabel])

  const status = progress >= 100 ? 'complete' : progress >= 55 ? 'pending' : 'active'
  const signalStrength = Math.max(18, Math.round(progress))

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_38%),linear-gradient(180deg,rgba(6,17,28,0.96),rgba(6,13,24,1))]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent_0,rgba(34,211,238,0.04)_50%,transparent_100%),repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(255,255,255,0.02)_3px,rgba(255,255,255,0.02)_4px)] opacity-80" />

      <div className="relative flex min-h-screen flex-col p-4 sm:p-6">
        <StatusBar
          variant="info"
          leftContent={
            <>
              <span>SECURE UPLINK</span>
              <span>LOGIN SEQUENCE ACCEPTED</span>
            </>
          }
          rightContent={
            <>
              <span>{serverLabel.toUpperCase()}</span>
              <span>{progress >= 100 ? 'GRID READY' : 'BOOTING'}</span>
            </>
          }
        />

        <div className="mx-auto flex w-full max-w-6xl flex-1 items-center py-6">
          <div className="relative w-full overflow-hidden rounded-[2rem] border border-border/60 bg-card/45 p-5 backdrop-blur-md sm:p-6">
            <HUDCornerFrame position="top-left" size={54} />
            <HUDCornerFrame position="top-right" size={54} />
            <HUDCornerFrame position="bottom-left" size={54} />
            <HUDCornerFrame position="bottom-right" size={54} />

            <UplinkHeader
              leftText="POST-LOGIN HANDSHAKE"
              rightText={progress >= 100 ? 'ROUTE OPEN' : 'ROUTING TO COMMAND NEXUS'}
              variant="cyan"
              className="-mx-5 -mt-5 mb-5 sm:-mx-6 sm:-mt-6"
            />

            <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <InfoPanel
                title="Operator Sync"
                subtitle="Identity Lock"
                status={status}
                className="min-h-[28rem]"
              >
                <div className="mt-2 flex h-full flex-col justify-between gap-6">
                  <div className="flex flex-col items-center gap-5 text-center">
                    <IdentityDisc
                      name="Grid Operator"
                      designation="Palworld Admin"
                      id="CTRL-01"
                      accessLevel="admin"
                      status="active"
                      className="scale-90 sm:scale-100"
                    />
                    <SignalIndicator
                      strength={signalStrength}
                      label="Link Integrity"
                      showValue
                      status={progress >= 70 ? 'connected' : progress >= 35 ? 'weak' : 'disconnected'}
                    />
                  </div>

                  <div className="space-y-4">
                    <ProgressTimeline
                      progress={progress}
                      currentLabel={progress >= 100 ? 'COMPLETE' : 'SYNCHRONIZING'}
                      markers={[
                        { position: 18, label: 'AUTH', active: progress >= 18 },
                        { position: 42, label: 'LINK', active: progress >= 42 },
                        { position: 68, label: 'CACHE', active: progress >= 68 },
                        { position: 92, label: 'GRID', active: progress >= 92 },
                      ]}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-border/50 bg-secondary/25 px-3 py-2">
                        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Target</div>
                        <div className="mt-1 font-mono text-sm text-primary">{serverLabel}</div>
                      </div>
                      <div className="rounded-lg border border-border/50 bg-secondary/25 px-3 py-2">
                        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Status</div>
                        <div className="mt-1 font-mono text-sm text-primary">
                          {progress >= 100 ? 'Command Grid Ready' : 'Initializing'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </InfoPanel>

              <Terminal
                title="GRID BOOTSTRAP"
                lines={terminalLines}
                variant="default"
                className="min-h-[28rem]"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
