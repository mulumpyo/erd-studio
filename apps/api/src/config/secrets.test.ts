import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { enableApiDocs, requireJwtSecret } from './secrets'

const originalNodeEnv = process.env.NODE_ENV
const originalSecret = process.env.JWT_SECRET
const originalDocs = process.env.ENABLE_API_DOCS

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
  if (originalSecret === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = originalSecret
  if (originalDocs === undefined) delete process.env.ENABLE_API_DOCS
  else process.env.ENABLE_API_DOCS = originalDocs
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

test('enableApiDocs is on in development by default', () => {
  process.env.NODE_ENV = 'development'
  delete process.env.ENABLE_API_DOCS
  assert.equal(enableApiDocs(), true)
})

test('enableApiDocs is off in production unless ENABLE_API_DOCS=true', () => {
  process.env.NODE_ENV = 'production'
  delete process.env.ENABLE_API_DOCS
  assert.equal(enableApiDocs(), false)
  process.env.ENABLE_API_DOCS = 'true'
  assert.equal(enableApiDocs(), true)
  process.env.ENABLE_API_DOCS = '1'
  assert.equal(enableApiDocs(), false)
})
