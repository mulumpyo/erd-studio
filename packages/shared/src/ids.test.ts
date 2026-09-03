import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createId, ensureStableId, fingerprint } from './ids'

test('createId uses a UUID and keeps the prefix', () => {
  const id = createId('tbl')
  assert.match(id, /^tbl_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
})

test('ensureStableId keeps an existing id when the name changes', () => {
  const id = 'tbl_keep-me'
  assert.equal(ensureStableId('tbl', id, 'users'), id)
  assert.equal(ensureStableId('tbl', id, 'members'), id)
})

test('missing ids are filled deterministically from the seed', () => {
  const first = ensureStableId('col', '', 'users:0:id')
  const second = ensureStableId('col', undefined, 'users:0:id')
  assert.equal(first, second)
  assert.equal(first, `col_${fingerprint('users:0:id')}`)
  assert.notEqual(
    ensureStableId('col', '', 'users:1:email'),
    ensureStableId('col', '', 'posts:1:email'),
  )
})
