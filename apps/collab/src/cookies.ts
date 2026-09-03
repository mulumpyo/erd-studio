export const ACCESS_COOKIE = 'erd_access'

export const parseCookieHeader = (header?: string) => {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const sep = part.indexOf('=')
    if (sep <= 0) continue
    const key = part.slice(0, sep).trim()
    const value = part.slice(sep + 1).trim()
    if (!key) continue
    try {
      out[key] = decodeURIComponent(value)
    } catch {
      out[key] = value
    }
  }
  return out
}

export const accessTokenFromCookie = (header?: string) =>
  parseCookieHeader(header)[ACCESS_COOKIE]
