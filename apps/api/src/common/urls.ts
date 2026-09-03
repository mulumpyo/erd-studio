const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export const webOrigin = () => {
  const origin = (process.env.WEB_ORIGIN ?? 'http://localhost:5173')
    .trim()
    .replace(/\/$/, '')
  if (!origin || origin === '*') {
    throw new Error(
      'WEB_ORIGIN must be a specific site origin (not *). Example: https://app.example.com',
    )
  }
  return origin
}

export const isAllowedBrowserOrigin = (origin: string) => {
  const presented = origin.trim().replace(/\/$/, '')
  try {
    const allowed = webOrigin()
    if (presented === allowed) return true
    if (process.env.NODE_ENV === 'production') return false
    return isLocalDevAlias(presented, allowed)
  } catch {
    return false
  }
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

export const safeInternalPath = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  if (value.includes('\\') || value.includes('://')) return null
  return value
}
