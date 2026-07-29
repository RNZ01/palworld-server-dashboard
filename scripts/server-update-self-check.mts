import assert from 'node:assert/strict'
import {
  emptyServerUpdateStatus,
  isServerUpdateActive,
  normalizeServerUpdateStatus,
} from '../lib/server-update.ts'

assert.equal(emptyServerUpdateStatus(false).phase, 'disabled')
assert.equal(emptyServerUpdateStatus(true).phase, 'idle')

const available = normalizeServerUpdateStatus(
  {
    phase: 'available',
    installedBuildId: '100',
    latestBuildId: '200',
    message: 'Update available',
    progress: 120,
  },
  true
)

assert.equal(available.updateAvailable, true)
assert.equal(available.progress, 100)
assert.equal(isServerUpdateActive(available), false)
assert.equal(isServerUpdateActive({ phase: 'downloading' }), true)
