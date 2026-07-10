import { Buffer } from 'node:buffer'
import { NextRequest, NextResponse } from 'next/server'
import { classifyPassword } from '@/lib/access-tier'
import { clientIp, isLockedOut, recordFailure } from '@/lib/rate-limit'
import { PALWORLD_PROXY_HEADERS } from '@/lib/palworld'
import type { AccessTier } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ path: string[] }>
}

interface ProxyServerConfig {
  serverIp: string
  serverPort: number
  adminPassword: string
  tier: AccessTier
}

// ─── SECURITY BOUNDARY: MOD-tier endpoint allowlist ─────────────────────────
// A mod-tier request may ONLY reach the endpoints below. Enforcement is
// method-aware, runs against the full decoded upstream path, and happens
// BEFORE any upstream contact — a mod-tier session hitting POST /shutdown
// from devtools gets a 403 right here. This allowlist (not UI hiding) is the
// security boundary. Admin tier and directly-entered real-admin-password
// requests are never filtered.
const MOD_TIER_ALLOWLIST: ReadonlySet<string> = new Set([
  'GET players', // roster for the widget
  'GET info', // server name + connect validation
  'GET metrics', // player count
  'POST kick',
  'POST ban',
  'POST unban',
])

function parsePort(value: string) {
  if (!/^\d+$/.test(value)) {
    return null
  }

  const port = Number.parseInt(value, 10)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null
  }

  return port
}

function buildUpstreamBaseUrl(serverIp: string, serverPort: number) {
  const normalizedHost = serverIp.trim()

  if (!normalizedHost) {
    return null
  }

  try {
    const baseUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(normalizedHost)
      ? new URL(normalizedHost)
      : new URL(`http://${normalizedHost}`)

    baseUrl.port = serverPort.toString()
    baseUrl.pathname = '/'
    baseUrl.search = ''
    baseUrl.hash = ''

    return baseUrl
  } catch {
    return null
  }
}

function getServerConfig(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  // SECURITY: the upstream REST target is PINNED server-side and is NOT
  // client-controllable. Before this, the proxy connected to any client-supplied
  // host:port — an SSRF once the panel is WAN-exposed (probe/POST to internal
  // hosts like 127.0.0.1:5432). Client serverIp/serverPort are now ignored.
  const pinned = new URL(process.env.PALWORLD_REST_URL ?? 'http://127.0.0.1:8212')
  const serverIp = pinned.hostname
  const serverPort = parsePort(pinned.port || '8212')
  const adminPassword =
    request.headers.get(PALWORLD_PROXY_HEADERS.adminPassword) ??
    searchParams.get('adminPassword') ??
    ''

  // perlica shim (2026-07-10): the browser never holds the real game admin
  // credential. Panel passwords are swapped server-side:
  //   PANEL_LOGIN_PASSWORD → real credential upstream, ADMIN tier (full access)
  //   MOD_PASSWORD         → real credential upstream, MOD tier (allowlist-enforced)
  //   real credential      → passes through unchanged, ADMIN tier
  //   anything else        → passes through unchanged, upstream rejects it (401)
  // The tier is re-derived from the presented password on EVERY request; no
  // client-supplied field can influence it.
  const realAdmin = process.env.PALWORLD_REAL_ADMIN_PASSWORD
  const passwordClass = classifyPassword(adminPassword)

  let tier: AccessTier = 'admin'
  let effectivePassword = adminPassword

  if (passwordClass === 'mod') {
    // Mod tier holds even if the real credential is missing from the env —
    // the request then fails upstream auth instead of gaining broader access.
    tier = 'mod'
    if (realAdmin) {
      effectivePassword = realAdmin
    }
  } else if (passwordClass === 'panel-admin' && realAdmin) {
    effectivePassword = realAdmin
  }

  if (serverPort == null || !adminPassword) {
    return null
  }

  return {
    serverIp: serverIp.trim(),
    serverPort,
    adminPassword: effectivePassword,
    tier,
  } satisfies ProxyServerConfig
}

async function getUpstreamRequestBody(request: NextRequest) {
  const contentType = request.headers.get('content-type')

  if (!contentType?.includes('application/json')) {
    return undefined
  }

  try {
    return JSON.stringify(await request.json())
  } catch {
    return undefined
  }
}

function parseProxyResponse(text: string) {
  if (!text) {
    return { success: true }
  }

  try {
    return JSON.parse(text)
  } catch {
    return { success: true, message: text }
  }
}

async function proxyPalworldRequest(request: NextRequest, { params }: RouteContext, method: 'GET' | 'POST') {
  // Brute-force limiter: block IPs with >=4 failed auth attempts in 4 min entirely
  // for the window; count only invalid-password attempts so valid polling is unaffected.
  const ip = clientIp(request)
  if (isLockedOut(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }
  const presented =
    request.headers.get(PALWORLD_PROXY_HEADERS.adminPassword) ??
    request.nextUrl.searchParams.get('adminPassword') ??
    ''
  if (classifyPassword(presented) === 'unknown') {
    recordFailure(ip)
  }

  const serverConfig = getServerConfig(request)

  if (!serverConfig) {
    return NextResponse.json({ error: 'Missing server configuration' }, { status: 400 })
  }

  const upstreamBaseUrl = buildUpstreamBaseUrl(serverConfig.serverIp, serverConfig.serverPort)

  if (!upstreamBaseUrl) {
    return NextResponse.json({ error: 'Invalid server host or REST API port' }, { status: 400 })
  }

  const { path } = await params

  // MOD-tier enforcement: exact match of "<METHOD> <decoded path>" against the
  // allowlist, checked before anything is forwarded upstream. Path segments
  // arrive URL-decoded from Next, so traversal and encoded-slash tricks
  // ("players/../shutdown", "players%2F..%2Fshutdown") produce keys that
  // simply do not match and are rejected. Case-sensitive by design: fail
  // closed on anything that is not an exact allowlisted endpoint.
  const decodedPath = path.join('/')

  if (serverConfig.tier === 'mod' && !MOD_TIER_ALLOWLIST.has(`${method} ${decodedPath}`)) {
    return NextResponse.json(
      { error: `Forbidden: "${method} /${decodedPath}" is not available to the mod tier` },
      { status: 403 }
    )
  }

  const upstreamPath = path.map((segment) => encodeURIComponent(segment)).join('/')
  const upstreamUrl = new URL(`/v1/api/${upstreamPath}`, upstreamBaseUrl)
  const body = method === 'POST' ? await getUpstreamRequestBody(request) : undefined

  try {
    const response = await fetch(upstreamUrl, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`admin:${serverConfig.adminPassword}`).toString('base64')}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
      cache: 'no-store',
    })
    const text = await response.text()

    if (!response.ok) {
      return NextResponse.json(
        { error: `Server responded with ${response.status}: ${text}` },
        { status: response.status }
      )
    }

    return NextResponse.json(parseProxyResponse(text))
  } catch (error) {
    console.error('Proxy error:', error)

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect to server' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  return proxyPalworldRequest(request, context, 'GET')
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxyPalworldRequest(request, context, 'POST')
}
