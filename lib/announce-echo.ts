export interface AnnounceEcho {
  type: 'chat'
  ts: string
  name: string
  text: string
}

const WINDOW_MS = 3 * 60 * 60 * 1000
const MAX_ECHOES = 200
const echoes: Array<AnnounceEcho & { at: number }> = []

function formatTs(date: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}

export function recordAnnounceEcho(message: string): void {
  const now = new Date()
  const m = /^(.{1,32}?):\s+(.*)$/s.exec(message)
  echoes.push({
    type: 'chat',
    ts: formatTs(now),
    name: m ? m[1]! : 'SYSTEM',
    text: m ? m[2]! : message,
    at: now.getTime(),
  })
  if (echoes.length > MAX_ECHOES) echoes.splice(0, echoes.length - MAX_ECHOES)
}

export function getAnnounceEchoes(): AnnounceEcho[] {
  const cutoff = Date.now() - WINDOW_MS
  return echoes.filter((echo) => echo.at >= cutoff).map(({ at: _at, ...event }) => event)
}
