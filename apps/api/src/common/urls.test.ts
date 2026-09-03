import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { isAllowedBrowserOrigin, webOrigin } from './urls'

const original = process.env.WEB_ORIGIN
const originalNodeEnv = process.env.NODE_ENV

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnv
  if (original === undefined) delete process.env.WEB_ORIGIN
  else process.env.WEB_ORIGIN = original
})

test('WEB_ORIGIN defaults to local Vite origin', () => {
  delete process.env.WEB_ORIGIN
  assert.equal(webOrigin(), 'http://localhost:5173')
})

test('WEB_ORIGIN cannot be *', () => {
  process.env.WEB_ORIGIN = '*'
  assert.throws(() => webOrigin(), /specific site origin/)
  process.env.WEB_ORIGIN = ' * '
  assert.throws(() => webOrigin(), /specific site origin/)
})

test('dev CORS allows localhost aliases and LAN Vite hosts', () => {
  process.env.NODE_ENV = 'development'
  process.env.WEB_ORIGIN = 'http://localhost:5173'
  assert.equal(isAllowedBrowserOrigin('http://localhost:5173'), true)
  assert.equal(isAllowedBrowserOrigin('http://127.0.0.1:5173'), true)
  assert.equal(isAllowedBrowserOrigin('http://192.168.0.10:5173'), true)
  assert.equal(isAllowedBrowserOrigin('https://evil.example'), false)
})

test('production CORS keeps a strict WEB_ORIGIN match', () => {
  process.env.NODE_ENV = 'production'
  process.env.WEB_ORIGIN = 'http://localhost:5173'
  assert.equal(isAllowedBrowserOrigin('http://localhost:5173'), true)
  assert.equal(isAllowedBrowserOrigin('http://127.0.0.1:5173'), false)
})
