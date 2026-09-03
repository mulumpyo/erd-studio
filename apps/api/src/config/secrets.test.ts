import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { requireJwtSecret } from './secrets'

const originalNodeEnv = process.env.NODE_ENV
const originalSecret = process.env.JWT_SECRET

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
})

test('missing JWT_SECRET fails closed', () => {
  delete process.env.JWT_SECRET
  process.env.NODE_ENV = 'development'
  assert.throws(() => requireJwtSecret(), /JWT_SECRET is required/)
})

test('empty JWT_SECRET fails closed', () => {
  process.env.JWT_SECRET = '   '
  process.env.NODE_ENV = 'development'
  assert.throws(() => requireJwtSecret(), /JWT_SECRET is required/)
})

test('production rejects placeholder and short secrets', () => {
  process.env.NODE_ENV = 'production'
  process.env.JWT_SECRET = 'change-me-in-production'
  assert.throws(() => requireJwtSecret(), /too weak for production/)
  process.env.JWT_SECRET = 'short-secret'
  assert.throws(() => requireJwtSecret(), /too weak for production/)
})

test('development allows a weak secret so self-host DX still works', () => {
  process.env.NODE_ENV = 'development'
  process.env.JWT_SECRET = 'change-me-in-production'
  assert.equal(requireJwtSecret(), 'change-me-in-production')
})
