import type { CookieOptions, Response } from 'express'
import { isProduction } from '../../config/secrets'
import { durationSeconds } from '../duration'
import { webOrigin } from '../urls'

export const ACCESS_COOKIE = 'erd_access'
export const REFRESH_COOKIE = 'erd_refresh'

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

export const readCookie = (
  req: { headers?: { cookie?: string }; cookies?: Record<string, string> },
  name: string,
) => req.cookies?.[name] || parseCookieHeader(req.headers?.cookie)[name]

export const accessExpiresSeconds = () =>
  durationSeconds(process.env.JWT_EXPIRES, 15 * 60)

export const refreshExpiresSeconds = () =>
  durationSeconds(process.env.JWT_REFRESH_EXPIRES, 14 * 86400)

const cookieSecure = () => {
  if (process.env.COOKIE_SECURE === 'true') return true
  if (process.env.COOKIE_SECURE === 'false') return false
  // 운영은 기본 Secure. TLS를 nginx에서 끊어도 브라우저→사이트는 https예요.
  if (isProduction()) return true
  try {
    return webOrigin().startsWith('https:')
  } catch {
    return false
  }
}

/** 테스트·점검용으로 쿠키 Secure 여부를 공개해요. */
export const isAuthCookieSecure = () => cookieSecure()

const cookieSameSite = (): CookieOptions['sameSite'] => {
  const value = process.env.COOKIE_SAMESITE?.toLowerCase()
  if (value === 'none' || value === 'lax' || value === 'strict') return value
  return 'lax'
}

/** 테스트·점검용으로 SameSite 값을 공개해요. */
export const authCookieSameSite = () => cookieSameSite()

const baseCookie = (maxAgeSeconds: number): CookieOptions => ({
  httpOnly: true,
  secure: cookieSecure(),
  sameSite: cookieSameSite(),
  path: '/',
  maxAge: maxAgeSeconds * 1000,
})

export const setAuthCookies = (
  res: Response,
  accessToken: string,
  refreshToken: string,
) => {
  res.cookie(ACCESS_COOKIE, accessToken, baseCookie(accessExpiresSeconds()))
  res.cookie(REFRESH_COOKIE, refreshToken, baseCookie(refreshExpiresSeconds()))
}

export const clearAuthCookies = (res: Response) => {
  const opts = { ...baseCookie(0), maxAge: 0 }
  res.cookie(ACCESS_COOKIE, '', opts)
  res.cookie(REFRESH_COOKIE, '', opts)
}
