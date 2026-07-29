import type { ServerUpdateStatus } from '@/lib/server-update'

export function buildDemoUpdateStatus(): ServerUpdateStatus {
  const now = Date.now()
  return {
    configured: true,
    phase: 'available',
    installedBuildId: '24181105',
    latestBuildId: '24370498',
    updateAvailable: true,
    message: 'A newer public Steam build is available.',
    progress: null,
    checkedAt: now,
    requestedAt: null,
    startedAt: null,
    completedAt: null,
    updatedAt: now,
  }
}
