import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inviteStatus } from './invite-status'

test('expired invite is expired', () => {
  assert.equal(
    inviteStatus({
      acceptedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    }),
    'expired',
  )
})

test('accepted invite cannot be reused', () => {
  assert.equal(
    inviteStatus({
      acceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    }),
    'accepted',
  )
})

test('pending invite is still valid', () => {
  assert.equal(
    inviteStatus({
      acceptedAt: null,
      declinedAt: null,
      expiresAt: new Date(Date.now() + 86_400_000),
    }),
    'pending',
  )
})

test('declined invite cannot be reused', () => {
  assert.equal(
    inviteStatus({
      acceptedAt: null,
      declinedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    }),
    'declined',
  )
})
