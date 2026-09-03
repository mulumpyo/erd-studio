import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  hashSecret,
  looksLikeSha256Hex,
  secretLookupValues,
} from './token-hash'

test('hashSecret is stable and not reversible', () => {
  const raw = 'invite-token-example'
  const hashed = hashSecret(raw)
  assert.equal(hashed.length, 64)
  assert.equal(looksLikeSha256Hex(hashed), true)
  assert.equal(hashSecret(raw), hashed)
  assert.notEqual(hashed, raw)
})

test('secretLookupValues checks hash then legacy plaintext', () => {
  const raw = 'legacy-plain-token'
  const values = secretLookupValues(raw)
  assert.deepEqual(values, [hashSecret(raw), raw])
})

test('presenting a leaked hash does not look up that hash', () => {
  const raw = 'invite-token-example'
  const leaked = hashSecret(raw)
  assert.deepEqual(secretLookupValues(leaked), [hashSecret(leaked)])
  assert.equal(secretLookupValues(leaked).includes(leaked), false)
})
