export type ServerUpdateAction = 'check' | 'update'

export type ServerUpdatePhase =
  | 'disabled'
  | 'idle'
  | 'queued'
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'announcing'
  | 'stopping'
  | 'backing-up'
  | 'downloading'
  | 'restarting'
  | 'complete'
  | 'failed'

export interface ServerUpdateStatus {
  configured: boolean
  phase: ServerUpdatePhase
  installedBuildId: string | null
  latestBuildId: string | null
  updateAvailable: boolean | null
  message: string
  progress: number | null
  checkedAt: number | null
  requestedAt: number | null
  startedAt: number | null
  completedAt: number | null
  updatedAt: number
  backupPath?: string
}

const ACTIVE_PHASES = new Set<ServerUpdatePhase>([
  'queued',
  'checking',
  'announcing',
  'stopping',
  'backing-up',
  'downloading',
  'restarting',
])

const KNOWN_PHASES = new Set<ServerUpdatePhase>([
  'disabled',
  'idle',
  'queued',
  'checking',
  'available',
  'up-to-date',
  'announcing',
  'stopping',
  'backing-up',
  'downloading',
  'restarting',
  'complete',
  'failed',
])

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function nullableTimestamp(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

export function isServerUpdateActive(status: Pick<ServerUpdateStatus, 'phase'>) {
  return ACTIVE_PHASES.has(status.phase)
}

export function emptyServerUpdateStatus(configured: boolean): ServerUpdateStatus {
  const now = Date.now()
  return {
    configured,
    phase: configured ? 'idle' : 'disabled',
    installedBuildId: null,
    latestBuildId: null,
    updateAvailable: null,
    message: configured
      ? 'Run an update check to compare the installed and public Steam builds.'
      : 'The host update integration is not enabled.',
    progress: null,
    checkedAt: null,
    requestedAt: null,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
  }
}

export function normalizeServerUpdateStatus(value: unknown, configured: boolean): ServerUpdateStatus {
  const fallback = emptyServerUpdateStatus(configured)
  if (!value || typeof value !== 'object') return fallback

  const input = value as Partial<ServerUpdateStatus>
  const phase = KNOWN_PHASES.has(input.phase as ServerUpdatePhase)
    ? (input.phase as ServerUpdatePhase)
    : fallback.phase
  const installedBuildId = nullableString(input.installedBuildId)
  const latestBuildId = nullableString(input.latestBuildId)
  const inferredAvailable =
    installedBuildId && latestBuildId ? installedBuildId !== latestBuildId : null
  const progress =
    typeof input.progress === 'number' && Number.isFinite(input.progress)
      ? Math.max(0, Math.min(100, input.progress))
      : null

  return {
    configured,
    phase: configured ? phase : 'disabled',
    installedBuildId,
    latestBuildId,
    updateAvailable:
      typeof input.updateAvailable === 'boolean' ? input.updateAvailable : inferredAvailable,
    message: typeof input.message === 'string' && input.message.trim() ? input.message : fallback.message,
    progress,
    checkedAt: nullableTimestamp(input.checkedAt),
    requestedAt: nullableTimestamp(input.requestedAt),
    startedAt: nullableTimestamp(input.startedAt),
    completedAt: nullableTimestamp(input.completedAt),
    updatedAt: nullableTimestamp(input.updatedAt) ?? Date.now(),
    ...(typeof input.backupPath === 'string' && input.backupPath.trim()
      ? { backupPath: input.backupPath.trim() }
      : {}),
  }
}
