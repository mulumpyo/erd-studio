import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  aiFeaturesEnabled,
  assertAiEnabled,
  disabledAiStatus,
} from './ai-features'
import { ServiceUnavailableException } from '@nestjs/common'

test('aiFeaturesEnabled reads AI_FEATURES_ENABLED strictly', () => {
  const prev = process.env.AI_FEATURES_ENABLED
  try {
    delete process.env.AI_FEATURES_ENABLED
    assert.equal(aiFeaturesEnabled(), false)
    process.env.AI_FEATURES_ENABLED = '1'
    assert.equal(aiFeaturesEnabled(), false)
    process.env.AI_FEATURES_ENABLED = 'true'
    assert.equal(aiFeaturesEnabled(), true)
  } finally {
    if (prev === undefined) delete process.env.AI_FEATURES_ENABLED
    else process.env.AI_FEATURES_ENABLED = prev
  }
})

test('disabledAiStatus is stable for clients', () => {
  const status = disabledAiStatus()
  assert.equal(status.available, false)
  assert.equal(status.requiresApiKey, true)
  assert.deepEqual([...status.providers], [])
})

test('assertAiEnabled throws ServiceUnavailableException when off', () => {
  const prev = process.env.AI_FEATURES_ENABLED
  try {
    delete process.env.AI_FEATURES_ENABLED
    assert.throws(() => assertAiEnabled(), ServiceUnavailableException)
  } finally {
    if (prev === undefined) delete process.env.AI_FEATURES_ENABLED
    else process.env.AI_FEATURES_ENABLED = prev
  }
})
