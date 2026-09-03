import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACCESS_COOKIE, parseCookieHeader, readCookie } from './cookies'

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
