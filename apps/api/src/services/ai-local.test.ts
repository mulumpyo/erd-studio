import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { generateErdLocally, sanitizeAiDocument } from './ai-local'

describe('ai-local', () => {
  it('builds a blog schema from a Korean prompt', () => {
    const doc = generateErdLocally('간단한 블로그 ERD')
    assert.ok(doc.tables.length >= 3)
    assert.ok(doc.relations.length >= 1)
  })

  it('builds tables from a comma list', () => {
    const doc = generateErdLocally('창고, 재고, 입고')
    assert.equal(doc.tables.length, 3)
  })

  it('sanitizes truncated LLM output', () => {
    const doc = sanitizeAiDocument({
      tables: [
        {
          id: 'tbl_a',
          logicalName: 'A',
          physicalName: 'a',
          color: '#3b82f6',
          position: { x: 0, y: 0 },
          columns: [],
        },
      ],
      relations: [],
      notes: [],
      domains: [],
      schemas: [],
      settings: { nameMode: 'both', show: {} },
    })
    assert.equal(doc.tables[0]?.columns.some((c) => c.pk), true)
  })
})
