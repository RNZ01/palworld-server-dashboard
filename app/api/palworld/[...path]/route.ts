import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const searchParams = request.nextUrl.searchParams
  const serverIp = searchParams.get('serverIp')
  const serverPort = searchParams.get('serverPort')
  const adminPassword = searchParams.get('adminPassword')

  if (!serverIp || !serverPort || !adminPassword) {
    return NextResponse.json({ error: 'Missing server configuration' }, { status: 400 })
  }

  const apiPath = path.join('/')
  const url = `http://${serverIp}:${serverPort}/v1/api/${apiPath}`

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`admin:${adminPassword}`).toString('base64'),
      },
    })

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json(
        { error: `Server responded with ${response.status}: ${text}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect to server' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const searchParams = request.nextUrl.searchParams
  const serverIp = searchParams.get('serverIp')
  const serverPort = searchParams.get('serverPort')
  const adminPassword = searchParams.get('adminPassword')

  if (!serverIp || !serverPort || !adminPassword) {
    return NextResponse.json({ error: 'Missing server configuration' }, { status: 400 })
  }

  const apiPath = path.join('/')
  const url = `http://${serverIp}:${serverPort}/v1/api/${apiPath}`

  let body = null
  const contentType = request.headers.get('content-type')
  
  if (contentType?.includes('application/json')) {
    try {
      body = await request.json()
    } catch {
      body = null
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`admin:${adminPassword}`).toString('base64'),
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const text = await response.text()
      return NextResponse.json(
        { error: `Server responded with ${response.status}: ${text}` },
        { status: response.status }
      )
    }

    // Some endpoints return empty response
    const text = await response.text()
    if (!text) {
      return NextResponse.json({ success: true })
    }

    try {
      const data = JSON.parse(text)
      return NextResponse.json(data)
    } catch {
      return NextResponse.json({ success: true, message: text })
    }
  } catch (error) {
    console.error('Proxy error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect to server' },
      { status: 500 }
    )
  }
}
