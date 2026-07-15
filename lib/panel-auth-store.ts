// SERVER-ONLY. Manages the panel's own login credentials (an `admin` password
// and an optional `mod` password) as scrypt hashes in a writable JSON file, so
// they can be changed at runtime from the UI without a redeploy.
//
// The game's real REST AdminPassword is NOT stored here — it stays in env
// (PALWORLD_ADMIN_PASSWORD) and the proxy swaps to it after a panel tier is
// verified, so the browser only ever holds a panel password.
//
// Per-request tier checks would be too slow if they scrypt-hashed every time
// (scrypt is deliberately expensive), so a short-lived in-memory cache keyed by
// a fast digest of the password serves the hot path; it's invalidated on any
// credential change and on process restart.
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { isDemoPassword } from '@/lib/demo-mode'
import type { AccessTier } from '@/lib/types'

const AUTH_FILE = process.env.PANEL_AUTH_FILE ?? (process.env.VERCEL ? '/tmp/panel-auth.json' : './data/panel-auth.json')
const N = 16384
const R = 8
const P = 1
const KEYLEN = 32
const CACHE_TTL_MS = 5 * 60 * 1000

interface Store {
  version: number
  admin: string
  mod: string | null
  updatedAt: string
}

// ── hashing ───────────────────────────────────────────────────────────────
function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${hash.toString('base64')}`
}

function verifyHash(password: string, stored: string): boolean {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = stored.split('$')
    if (scheme !== 'scrypt') return false
    const salt = Buffer.from(saltB64, 'base64')
    const expected = Buffer.from(hashB64, 'base64')
    const actual = scryptSync(password, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p) })
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

// ── file store (seed on first run, atomic writes) ───────────────────────────
let cached: Store | null = null

function loadStore(): Store | null {
  if (cached) return cached
  try {
    if (existsSync(AUTH_FILE)) {
      cached = JSON.parse(readFileSync(AUTH_FILE, 'utf8')) as Store
      return cached
    }
  } catch {
    // unreadable/corrupt file → fall through to seed logic
  }
  const seedAdmin = process.env.PANEL_INITIAL_ADMIN_PASSWORD
  if (!seedAdmin) return null // fail closed: no file, no seed → nobody authenticates
  if (seedAdmin.length < 6) {
    console.warn('[panel-auth] PANEL_INITIAL_ADMIN_PASSWORD is shorter than 6 characters — use a strong value.')
  }
  const seedMod = process.env.PANEL_INITIAL_MOD_PASSWORD || null
  const store: Store = {
    version: 1,
    admin: hashPassword(seedAdmin),
    mod: seedMod ? hashPassword(seedMod) : null,
    updatedAt: new Date().toISOString(),
  }
  saveStore(store)
  return store
}

function saveStore(store: Store): void {
  mkdirSync(dirname(AUTH_FILE), { recursive: true })
  const tmp = `${AUTH_FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(store, null, 2), { mode: 0o600 })
  renameSync(tmp, AUTH_FILE)
  cached = store
  verifyCacheClear()
}

// ── fast per-request verification cache ─────────────────────────────────────
const verifyCache = new Map<string, { tier: AccessTier; exp: number }>()
function fastKey(password: string) {
  return createHash('sha256').update(password).digest('base64')
}
function verifyCacheClear() {
  verifyCache.clear()
}

/** Resolve a presented password to a tier, or null if it matches neither. */
export function verifyTier(password: string): AccessTier | null {
  if (isDemoPassword(password)) return 'admin'
  if (!password) return null
  const key = fastKey(password)
  const hit = verifyCache.get(key)
  if (hit && hit.exp > Date.now()) return hit.tier

  const store = loadStore()
  if (!store) return null

  let tier: AccessTier | null = null
  // mod-first so a mod==admin collision resolves to the LOWER privilege.
  if (store.mod && verifyHash(password, store.mod)) tier = 'mod'
  else if (verifyHash(password, store.admin)) tier = 'admin'

  if (tier) verifyCache.set(key, { tier, exp: Date.now() + CACHE_TTL_MS })
  return tier
}

export function verifyAdmin(password: string): boolean {
  return verifyTier(password) === 'admin'
}

export function isModEnabled(): boolean {
  const store = loadStore()
  return !!(store && store.mod)
}

export function setAdminPassword(newPassword: string): void {
  const store = loadStore()
  const base: Store = store ?? { version: 1, admin: '', mod: null, updatedAt: '' }
  saveStore({ ...base, admin: hashPassword(newPassword), updatedAt: new Date().toISOString() })
}

/** Set (enable/change) the mod password, or pass null to disable the mod tier. */
export function setModPassword(newPassword: string | null): void {
  const store = loadStore()
  if (!store) throw new Error('panel auth not initialized')
  saveStore({ ...store, mod: newPassword ? hashPassword(newPassword) : null, updatedAt: new Date().toISOString() })
}
