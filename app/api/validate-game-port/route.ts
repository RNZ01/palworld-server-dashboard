import dgram from 'node:dgram'
import net from 'node:net'
import { NextRequest, NextResponse } from 'next/server'

const CONNECTION_TIMEOUT_MS = 2_500
const UDP_PROBE_TIMEOUT_MS = 1_500
const CONNECTIONLESS_HEADER = Buffer.from([0xff, 0xff, 0xff, 0xff])
const SOURCE_QUERY_PREFIX = Buffer.from('Source Engine Query\x00', 'binary')
const A2S_INFO_RESPONSE = 0x49
const A2S_CHALLENGE_RESPONSE = 0x41

function buildSourceQueryPacket(challengeToken?: Buffer) {
  return Buffer.concat([
    CONNECTIONLESS_HEADER,
    Buffer.from([0x54]),
    SOURCE_QUERY_PREFIX,
    ...(challengeToken ? [challengeToken] : []),
  ])
}

function readQueryResponseType(message: Buffer) {
  if (message.length < 5) {
    return null
  }

  if (!message.subarray(0, 4).equals(CONNECTIONLESS_HEADER)) {
    return null
  }

  return message[4]
}

function extractChallengeToken(message: Buffer) {
  if (readQueryResponseType(message) !== A2S_CHALLENGE_RESPONSE || message.length < 9) {
    return null
  }

  return message.subarray(5, 9)
}

function normalizeHost(serverIp: string) {
  const raw = serverIp.trim()
  if (!raw) {
    return null
  }

  try {
    if (/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(raw)) {
      const host = new URL(raw).hostname
      return host || null
    }

    if (raw.includes('/') || raw.includes(':')) {
      const host = new URL(`http://${raw}`).hostname
      return host || null
    }
  } catch {
    // Fallback below.
  }

  return raw.replace(/^\[|\]$/g, '') || null
}

function parseGamePort(value: string) {
  if (!/^\d+$/.test(value)) {
    return null
  }

  const port = Number.parseInt(value, 10)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null
  }

  return port
}

function pingTcpPort(host: string, port: number) {
  return new Promise<void>((resolve, reject) => {
    const socket = new net.Socket()
    let settled = false

    const cleanup = () => {
      socket.removeAllListeners()
      socket.destroy()
    }

    const finish = (error?: Error) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()

      if (error) {
        reject(error)
      } else {
        resolve()
      }
    }

    socket.setTimeout(CONNECTION_TIMEOUT_MS)
    socket.once('connect', () => finish())
    socket.once('timeout', () => finish(new Error('Game port ping timed out')))
    socket.once('error', (error) => finish(error))
    socket.connect(port, host)
  })
}

function probeUdpPort(host: string, port: number) {
  return new Promise<void>((resolve, reject) => {
    const addressFamily = net.isIP(host) === 6 ? 'udp6' : 'udp4'
    const socket = dgram.createSocket(addressFamily)
    let settled = false
    let retriedWithChallenge = false

    const finish = (error?: Error) => {
      if (settled) {
        return
      }

      settled = true
      socket.removeAllListeners()
      socket.close()

      if (error) {
        reject(error)
      } else {
        resolve()
      }
    }

    const timeout = setTimeout(() => {
      finish(new Error('No UDP response received'))
    }, UDP_PROBE_TIMEOUT_MS)

    const complete = (error?: Error) => {
      clearTimeout(timeout)
      finish(error)
    }

    socket.once('error', (error) => {
      complete(error)
    })

    socket.on('message', (message) => {
      const responseType = readQueryResponseType(message)

      if (responseType === A2S_INFO_RESPONSE) {
        complete()
        return
      }

      if (responseType === A2S_CHALLENGE_RESPONSE && !retriedWithChallenge) {
        const challengeToken = extractChallengeToken(message)
        if (!challengeToken) {
          return
        }

        retriedWithChallenge = true
        socket.send(buildSourceQueryPacket(challengeToken), port, host, (retryError) => {
          if (retryError) {
            complete(retryError)
          }
        })
      }
    })

    socket.send(buildSourceQueryPacket(), port, host, (sendError) => {
      if (sendError) {
        complete(sendError)
      }
    })
  })
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const serverIp = searchParams.get('serverIp') ?? ''
  const gamePort = searchParams.get('gamePort') ?? ''

  const host = normalizeHost(serverIp)
  const port = parseGamePort(gamePort)

  if (!host || port == null) {
    return NextResponse.json({ error: 'Invalid server host or game port' }, { status: 400 })
  }

  let tcpStatus = 'TCP probe skipped'

  try {
    await pingTcpPort(host, port)
    tcpStatus = 'TCP reachable'
  } catch (error) {
    tcpStatus = error instanceof Error ? `TCP check failed: ${error.message}` : 'TCP check failed'
  }

  try {
    await probeUdpPort(host, port)
    return NextResponse.json({
      success: true,
      host,
      port,
      protocol: 'udp-query',
      note: 'Validated with a real query response from the game service.',
      tcpStatus,
    })
  } catch (udpError) {
    const udpMessage = udpError instanceof Error ? udpError.message : 'UDP probe failed'
    return NextResponse.json(
      {
        error: `Game port check failed. UDP query did not return a valid game-service response. ${tcpStatus}. UDP: ${udpMessage}`,
      },
      { status: 400 }
    )
  }
}
