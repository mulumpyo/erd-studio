import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { emptyDocument, type ErdDocument } from '@erd-studio/shared'
import {
  applyAiPatch,
  buildChatContext,
  compactDocumentForWire,
  resolveChatDocument,
  selectRelatedTableIds,
  trimChatHistory,
} from './ai-chat-context'

const sampleDoc = (): ErdDocument => {
  const base = emptyDocument()
  return {
    ...base,
    notes: [
      {
        id: 'note_1',
        text: 'keep me',
        color: '#fef3c7',
        position: { x: 10, y: 10 },
        width: 160,
        height: 80,
      },
    ],
    tables: [
      {
        id: 'tbl_users',
        schemaId: '',
        logicalName: '사용자',
        physicalName: 'users',
        color: '#3b82f6',
        position: { x: 80, y: 80 },
        columns: [
          {
            id: 'col_users_id',
            logicalName: 'ID',
            physicalName: 'id',
            type: 'int',
            length: null,
            pk: true,
            fk: false,
            nn: true,
            unique: false,
            autoIncrement: true,
          },
        ],
      },
      {
        id: 'tbl_orders',
        schemaId: '',
        logicalName: '주문',
        physicalName: 'orders',
        color: '#22c55e',
        position: { x: 360, y: 80 },
        columns: [
          {
            id: 'col_orders_id',
            logicalName: 'ID',
            physicalName: 'id',
            type: 'int',
            length: null,
            pk: true,
            fk: false,
            nn: true,
            unique: false,
            autoIncrement: true,
          },
          {
            id: 'col_orders_user',
            logicalName: '주문자',
            physicalName: 'user_id',
            type: 'int',
            length: null,
            pk: false,
            fk: true,
            nn: true,
            unique: false,
            autoIncrement: false,
          },
        ],
      },
      {
        id: 'tbl_products',
        schemaId: '',
        logicalName: '상품',
        physicalName: 'products',
        color: '#a855f7',
        position: { x: 640, y: 80 },
        columns: [
          {
            id: 'col_products_id',
            logicalName: 'ID',
            physicalName: 'id',
            type: 'int',
            length: null,
            pk: true,
            fk: false,
            nn: true,
            unique: false,
            autoIncrement: true,
          },
        ],
      },
      {
        id: 'tbl_a',
        schemaId: '',
        logicalName: '창고',
        physicalName: 'warehouses',
        color: '#f59e0b',
        position: { x: 80, y: 300 },
        columns: [
          {
            id: 'col_a_id',
            logicalName: 'ID',
            physicalName: 'id',
            type: 'int',
            length: null,
            pk: true,
            fk: false,
            nn: true,
            unique: false,
            autoIncrement: true,
          },
        ],
      },
      {
        id: 'tbl_b',
        schemaId: '',
        logicalName: '재고',
        physicalName: 'stocks',
        color: '#ef4444',
        position: { x: 360, y: 300 },
        columns: [
          {
            id: 'col_b_id',
            logicalName: 'ID',
            physicalName: 'id',
            type: 'int',
            length: null,
            pk: true,
            fk: false,
            nn: true,
            unique: false,
            autoIncrement: true,
          },
        ],
      },
      {
        id: 'tbl_c',
        schemaId: '',
        logicalName: '공급',
        physicalName: 'supplies',
        color: '#14b8a6',
        position: { x: 640, y: 300 },
        columns: [
          {
            id: 'col_c_id',
            logicalName: 'ID',
            physicalName: 'id',
            type: 'int',
            length: null,
            pk: true,
            fk: false,
            nn: true,
            unique: false,
            autoIncrement: true,
          },
        ],
      },
      {
        id: 'tbl_d',
        schemaId: '',
        logicalName: '배송',
        physicalName: 'shipments',
        color: '#64748b',
        position: { x: 80, y: 520 },
        columns: [
          {
            id: 'col_d_id',
            logicalName: 'ID',
            physicalName: 'id',
            type: 'int',
            length: null,
            pk: true,
            fk: false,
            nn: true,
            unique: false,
            autoIncrement: true,
          },
        ],
      },
    ],
    relations: [
      {
        id: 'rel_orders_users',
        sourceTableId: 'tbl_orders',
        targetTableId: 'tbl_users',
        sourceColumnIds: ['col_orders_user'],
        targetColumnIds: ['col_users_id'],
        kind: 'non-identifying',
        sourceCardinality: 'N',
        targetCardinality: '1',
      },
    ],
  }
}

describe('selectRelatedTableIds', () => {
  it('returns all ids for small documents', () => {
    const doc = sampleDoc()
    doc.tables = doc.tables.slice(0, 3)
    assert.equal(selectRelatedTableIds(doc, '아무거나').length, 3)
  })

  it('matches mentioned tables and relation neighbors', () => {
    const ids = selectRelatedTableIds(sampleDoc(), '주문 테이블에 배송지 추가')
    assert.ok(ids.includes('tbl_orders'))
    assert.ok(ids.includes('tbl_users'))
    assert.ok(!ids.includes('tbl_d'))
  })

  it('matches Korean particles on table names', () => {
    const ids = selectRelatedTableIds(sampleDoc(), '상품에 가격을 추가해 줘')
    assert.ok(ids.includes('tbl_products'))
  })
})

describe('buildChatContext', () => {
  it('omits notes/settings and can truncate detail tables', () => {
    const ctx = buildChatContext(sampleDoc(), '상품 가격 컬럼')
    assert.ok(ctx.tableIndex.length === 7)
    assert.ok(ctx.tables.some((t) => t.id === 'tbl_products'))
    assert.equal(
      Object.prototype.hasOwnProperty.call(ctx.tables[0] || {}, 'color'),
      false,
    )
  })
})

describe('applyAiPatch / resolveChatDocument', () => {
  it('upserts a column via patch and keeps notes', () => {
    const current = sampleDoc()
    const next = applyAiPatch(current, {
      upsertTables: [
        {
          id: 'tbl_orders',
          logicalName: '주문',
          physicalName: 'orders',
          color: '#22c55e',
          position: { x: 360, y: 80 },
          columns: [
            {
              id: 'col_orders_id',
              logicalName: 'ID',
              physicalName: 'id',
              type: 'int',
              pk: true,
              nn: true,
              autoIncrement: true,
            },
            {
              id: 'col_orders_user',
              logicalName: '주문자',
              physicalName: 'user_id',
              type: 'int',
              fk: true,
              nn: true,
            },
            {
              id: 'col_orders_addr',
              logicalName: '배송지',
              physicalName: 'shipping_address',
              type: 'varchar',
              length: '255',
            },
          ],
        },
      ],
    })
    assert.equal(next.notes[0]?.text, 'keep me')
    assert.equal(next.tables.length, current.tables.length)
    const orders = next.tables.find((t) => t.id === 'tbl_orders')
    assert.ok(orders?.columns.some((c) => c.physicalName === 'shipping_address'))
  })

  it('merges column-only upsertColumns without rewriting the table', () => {
    const current = sampleDoc()
    const next = applyAiPatch(current, {
      upsertColumns: [
        {
          tableId: 'tbl_orders',
          columns: [
            {
              id: 'col_orders_addr',
              logicalName: '배송지',
              physicalName: 'shipping_address',
              type: 'varchar',
              length: '255',
              nn: true,
            },
          ],
        },
      ],
    })
    const orders = next.tables.find((t) => t.id === 'tbl_orders')
    assert.equal(orders?.columns.length, 3)
    assert.ok(orders?.columns.some((c) => c.physicalName === 'user_id'))
    assert.ok(orders?.columns.some((c) => c.physicalName === 'shipping_address'))
  })

  it('removes columns and tables via patch ids', () => {
    const current = sampleDoc()
    const next = applyAiPatch(current, {
      upsertColumns: [
        {
          tableId: 'tbl_orders',
          removeColumnIds: ['col_orders_user'],
        },
      ],
      removeTableIds: ['tbl_products'],
      removeRelationIds: ['rel_orders_users'],
    })
    assert.ok(!next.tables.some((t) => t.id === 'tbl_products'))
    const orders = next.tables.find((t) => t.id === 'tbl_orders')
    assert.ok(!orders?.columns.some((c) => c.id === 'col_orders_user'))
    assert.ok(!next.relations.some((r) => r.id === 'rel_orders_users'))
  })

  it('compacts documents for wire without false flags', () => {
    const slim = compactDocumentForWire(sampleDoc())
    const col = slim.tables[0]?.columns[0] as Record<string, unknown>
    assert.equal(slim.notes[0]?.text, 'keep me')
    assert.equal(col?.pk, true)
    assert.equal(Object.prototype.hasOwnProperty.call(col || {}, 'fk'), false)
  })

  it('honors unchanged and preserves document on resolve', () => {
    const current = sampleDoc()
    const next = resolveChatDocument(current, {
      message: '질문만 답함',
      unchanged: true,
    })
    assert.equal(next.mode, 'unchanged')
    assert.equal(next.document.tables.length, current.tables.length)
    assert.equal(next.document.notes[0]?.id, 'note_1')
  })

  it('falls back to full document replace while keeping notes', () => {
    const current = sampleDoc()
    const next = resolveChatDocument(current, {
      message: '전체 교체',
      document: {
        tables: [
          {
            id: 'tbl_brand_new',
            logicalName: '단독',
            physicalName: 'only',
            color: '#3b82f6',
            position: { x: 0, y: 0 },
            columns: [],
          },
        ],
        relations: [],
      },
    })
    assert.equal(next.mode, 'document')
    assert.equal(next.document.tables.length, 1)
    assert.equal(next.document.notes[0]?.text, 'keep me')
  })

  it('merges partial full-document payloads that reuse existing ids', () => {
    const current = sampleDoc()
    const next = resolveChatDocument(current, {
      message: '주문만 고침',
      document: {
        tables: [
          {
            id: 'tbl_orders',
            logicalName: '주문',
            physicalName: 'orders',
            color: '#22c55e',
            position: { x: 360, y: 80 },
            columns: [
              {
                id: 'col_orders_id',
                logicalName: 'ID',
                physicalName: 'id',
                type: 'int',
                pk: true,
                nn: true,
                autoIncrement: true,
              },
            ],
          },
        ],
        relations: [],
      },
    })
    assert.equal(next.mode, 'document-merge')
    assert.ok(next.document.tables.length > 1)
    assert.ok(next.document.tables.some((t) => t.id === 'tbl_users'))
  })

  it('matches deixis using history table names', () => {
    const ids = selectRelatedTableIds(
      sampleDoc(),
      '주문에 컬럼을 추가했어요\n그거에 배송일도 넣어 줘',
    )
    assert.ok(ids.includes('tbl_orders'))
  })

  it('tolerates one-character typos in table names', () => {
    const ids = selectRelatedTableIds(sampleDoc(), '주먼 테이블 수정')
    assert.ok(ids.includes('tbl_orders'))
  })
})

describe('trimChatHistory', () => {
  it('keeps the last 6 messages and truncates long content', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `m${i}-` + 'x'.repeat(2000),
    }))
    const trimmed = trimChatHistory(history)
    assert.equal(trimmed.length, 6)
    assert.ok(trimmed[0]!.content.length <= 800)
  })
})
