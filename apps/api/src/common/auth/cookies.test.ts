import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { isAuthCookieSecure, parseCookieHeader, readCookie, ACCESS_COOKIE } from './cookies'

const originalNodeEnv = process.env.NODE_ENV
const originalSecure = process.env.COOKIE_SECURE
const originalOrigin = process.env.WEB_ORIGIN

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
  if (originalSecure === undefined) delete process.env.COOKIE_SECURE
  else process.env.COOKIE_SECURE = originalSecure
  if (originalOrigin === undefined) delete process.env.WEB_ORIGIN
  else process.env.WEB_ORIGIN = originalOrigin
})

test('parseCookieHeader reads httpOnly session cookies', () => {
  const parsed = parseCookieHeader(
    `${ACCESS_COOKIE}=abc.def; erd_refresh=id.secret`,
  )
  assert.equal(parsed[ACCESS_COOKIE], 'abc.def')
  assert.equal(parsed.erd_refresh, 'id.secret')
})

test('readCookie prefers parsed header and ignores missing cookies', () => {
  assert.equal(
    readCookie({ headers: { cookie: `${ACCESS_COOKIE}=token-value` } }, ACCESS_COOKIE),
    'token-value',
  )
  assert.equal(readCookie({ headers: {} }, ACCESS_COOKIE), undefined)
})

test('production cookies are Secure by default even if WEB_ORIGIN is http', () => {
  process.env.NODE_ENV = 'production'
  delete process.env.COOKIE_SECURE
  process.env.WEB_ORIGIN = 'http://127.0.0.1:8082'
  assert.equal(isAuthCookieSecure(), true)
})

test('COOKIE_SECURE=false opts out of Secure in production', () => {
  process.env.NODE_ENV = 'production'
  process.env.COOKIE_SECURE = 'false'
  assert.equal(isAuthCookieSecure(), false)
})

test('development cookies follow https WEB_ORIGIN', () => {
  process.env.NODE_ENV = 'development'
  delete process.env.COOKIE_SECURE
  process.env.WEB_ORIGIN = 'https://app.example.com'
  assert.equal(isAuthCookieSecure(), true)
  process.env.WEB_ORIGIN = 'http://localhost:5173'
  assert.equal(isAuthCookieSecure(), false)
})
