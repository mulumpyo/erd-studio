import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pageResult, parsePage } from '../common/paging'

test('parsePage clamps page and limit', () => {
  assert.deepEqual(parsePage(0, 0), { skip: 0, take: 8, page: 1, limit: 8 })
  assert.equal(parsePage(2, 10).skip, 10)
  assert.equal(parsePage(1, 100).limit, 50)
})

test('pageResult reports total pages', () => {
  const result = pageResult(['a'], 20, 1, 8)
  assert.equal(result.pages, 3)
  assert.equal(result.total, 20)
})
