const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export const allowedWebOrigin = () =>
  (process.env.WEB_ORIGIN ?? 'http://localhost:5173').trim().replace(/\/$/, '')

export const isAllowedCollabOrigin = (origin: string | undefined) => {
  const allowed = allowedWebOrigin()
  if (!allowed || allowed === '*') return false
  if (!origin) return true
  const presented = origin.replace(/\/$/, '')
  if (presented === allowed) return true
  if (process.env.NODE_ENV === 'production') return false
  return isLocalDevAlias(presented, allowed)
}

const isLocalDevAlias = (origin: string, allowed: string) => {
  try {
    const expected = new URL(allowed)
    const actual = new URL(origin)
    if (expected.protocol !== actual.protocol) return false
    if (portOf(expected) !== portOf(actual)) return false
    if (isLoopback(expected.hostname) && isLoopback(actual.hostname)) return true
    return isLoopback(expected.hostname) && isPrivateHostname(actual.hostname)
  } catch {
    return false
  }
}

const portOf = (url: URL) =>
  url.port || (url.protocol === 'https:' ? '443' : '80')

const isLoopback = (hostname: string) => LOOPBACK.has(hostname)

const isPrivateHostname = (hostname: string) => {
  if (isLoopback(hostname)) return true
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname)
  if (!match) return false
  const a = Number(match[1])
  const b = Number(match[2])
  if (a === 10 || a === 127) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
}
