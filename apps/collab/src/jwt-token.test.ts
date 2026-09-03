import assert from 'node:assert/strict'
import { test } from 'node:test'
import jwt from 'jsonwebtoken'

const secret = 'unit-test-secret-16'
const opts = { algorithms: ['HS256'] as jwt.Algorithm[] }

test('invalid signature is rejected', () => {
  const token = jwt.sign({ sub: 'user-a', email: 'a@x.com' }, 'other-secret-16xx', {
    algorithm: 'HS256',
    expiresIn: '15m',
  })
  assert.throws(() => jwt.verify(token, secret, opts))
})

test('expired access token is rejected', () => {
  const token = jwt.sign({ sub: 'user-a', email: 'a@x.com' }, secret, {
    algorithm: 'HS256',
    expiresIn: -10,
  })
  assert.throws(() => jwt.verify(token, secret, opts))
})

test('malformed token is rejected', () => {
  assert.throws(() => jwt.verify('not-a-jwt', secret, opts))
  assert.throws(() => jwt.verify('a.b', secret, opts))
})

test('refresh token shape cannot be used as an access token', () => {
  const refresh = 'tokenid.super-secret-refresh-value'
  assert.throws(() => jwt.verify(refresh, secret, opts))
})

test('valid HS256 access token is accepted', () => {
  const token = jwt.sign({ sub: 'user-a', email: 'a@x.com' }, secret, {
    algorithm: 'HS256',
    expiresIn: '15m',
  })
  const payload = jwt.verify(token, secret, opts) as jwt.JwtPayload
  assert.equal(payload.sub, 'user-a')
})
