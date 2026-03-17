import { Buffer } from 'node:buffer'
import { NextRequest, NextResponse } from 'next/server'

type RouteContext = {
  params: Promise<{ path: string[] }>
}

function getServerConfig(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const serverIp = searchParams.get('serverIp')
  const serverPort = searchParams.get('serverPort')
  const adminPassword = searchParams.get('adminPassword')

  if (!serverIp || !serverPort || !adminPassword) {
    return null
  }

  return { serverIp, serverPort, adminPassword }
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
  const serverConfig = getServerConfig(request)

  if (!serverConfig) {
    return NextResponse.json({ error: 'Missing server configuration' }, { status: 400 })
  }

  const { path } = await params
  const upstreamUrl = `http://${serverConfig.serverIp}:${serverConfig.serverPort}/v1/api/${path.join('/')}`
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
