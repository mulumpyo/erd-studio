import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { isAllowedCollabOrigin } from './origin'

const original = process.env.WEB_ORIGIN
const originalNodeEnv = process.env.NODE_ENV

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnv
  if (original === undefined) delete process.env.WEB_ORIGIN
  else process.env.WEB_ORIGIN = original
})

test('missing Origin is allowed for non-browser clients', () => {
  process.env.WEB_ORIGIN = 'https://app.example.com'
  assert.equal(isAllowedCollabOrigin(undefined), true)
})

test('browser Origin must match WEB_ORIGIN', () => {
  process.env.WEB_ORIGIN = 'https://app.example.com'
  assert.equal(isAllowedCollabOrigin('https://app.example.com'), true)
  assert.equal(isAllowedCollabOrigin('https://app.example.com/'), true)
  assert.equal(isAllowedCollabOrigin('https://evil.example'), false)
})

test('wildcard WEB_ORIGIN is rejected', () => {
  process.env.WEB_ORIGIN = '*'
  assert.equal(isAllowedCollabOrigin('https://app.example.com'), false)
  assert.equal(isAllowedCollabOrigin(undefined), false)
})

test('dev allows localhost and 127.0.0.1 aliases on the same port', () => {
  process.env.NODE_ENV = 'development'
  process.env.WEB_ORIGIN = 'http://localhost:5173'
  assert.equal(isAllowedCollabOrigin('http://127.0.0.1:5173'), true)
  assert.equal(isAllowedCollabOrigin('http://192.168.0.10:5173'), true)
  assert.equal(isAllowedCollabOrigin('http://127.0.0.1:3000'), false)
  assert.equal(isAllowedCollabOrigin('https://evil.example'), false)
})

test('production keeps a strict WEB_ORIGIN match', () => {
  process.env.NODE_ENV = 'production'
  process.env.WEB_ORIGIN = 'http://localhost:5173'
  assert.equal(isAllowedCollabOrigin('http://127.0.0.1:5173'), false)
  assert.equal(isAllowedCollabOrigin('http://localhost:5173'), true)
})
