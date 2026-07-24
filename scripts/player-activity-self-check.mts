import assert from 'node:assert/strict'
import { diffPlayerActivity } from '../lib/player-activity.ts'

const previous = [
  { name: 'Alice', userId: 'u1', playerId: 'p1' },
  { name: 'Bob', userId: 'u2', playerId: 'p2' },
]
const current = [
  { name: 'Alice renamed', userId: 'u1', playerId: 'p1' },
  { name: 'Carol', userId: 'u3', playerId: 'p3' },
]

assert.deepEqual(diffPlayerActivity(previous, current, 123), [
  { timestamp: 123, type: 'join', name: 'Carol' },
  { timestamp: 123, type: 'leave', name: 'Bob' },
])
