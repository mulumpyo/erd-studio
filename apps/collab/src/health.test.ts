import assert from 'node:assert/strict'
import { test } from 'node:test'
import { collabHealthPayload } from './health'

test('collabHealthPayload succeeds when redis and prisma respond', async () => {
  const body = await collabHealthPayload(
    { ping: async () => 'PONG' },
    { $queryRaw: async () => [{ ok: 1 }] },
  )
  assert.deepEqual(body, { ok: true })
})

test('collabHealthPayload fails when redis is down', async () => {
  await assert.rejects(
    () =>
      collabHealthPayload(
        { ping: async () => 'NOPE' },
        { $queryRaw: async () => [{ ok: 1 }] },
      ),
    /redis/,
  )
})
