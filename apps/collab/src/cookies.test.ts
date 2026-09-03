import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ACCESS_COOKIE, accessTokenFromCookie } from './cookies'

test('reads access cookie from websocket Cookie header', () => {
  assert.equal(
    accessTokenFromCookie(`${ACCESS_COOKIE}=abc.def.ghi; other=1`),
    'abc.def.ghi',
  )
  assert.equal(accessTokenFromCookie(undefined), undefined)
})
