import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { AiService } from './ai.service'

const baseDoc = {
  schemas: [],
  notes: [
    {
      id: 'note_1',
      text: 'memo',
      color: '#fef3c7',
      position: { x: 0, y: 0 },
      width: 100,
      height: 80,
    },
  ],
  domains: [],
  settings: { nameMode: 'both' as const, show: {} },
  tables: [
    {
      id: 'tbl_orders',
      schemaId: '',
      logicalName: '주문',
      physicalName: 'orders',
      color: '#22c55e',
      position: { x: 80, y: 80 },
      columns: [
        {
          id: 'col_orders_id',
          logicalName: 'ID',
          physicalName: 'id',
          type: 'int',
          length: undefined,
          pk: true,
          fk: false,
          nn: true,
          unique: false,
          autoIncrement: true,
        },
      ],
    },
  ],
  relations: [],
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const chatCompletion = (payload: unknown) =>
  jsonResponse({
    choices: [{ message: { content: JSON.stringify(payload) } }],
  })

describe('AiService with mocked fetch', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('listModels returns filtered OpenAI chat models', async () => {
    globalThis.fetch = async () =>
      jsonResponse({
        data: [
          { id: 'gpt-4o-mini' },
          { id: 'text-embedding-3-small' },
          { id: 'o3-mini' },
        ],
      })
    const ai = new AiService()
    const result = await ai.listModels('openai', 'sk-test-key-123456')
    assert.deepEqual(
      result.models.map((m) => m.id),
      ['gpt-4o-mini', 'o3-mini'],
    )
    assert.equal(result.defaultModel, 'gpt-4o-mini')
  })

  it('chat omits document when unchanged', async () => {
    globalThis.fetch = async () =>
      chatCompletion({ message: '질문�??�했?�요', unchanged: true })
    const ai = new AiService()
    const result = await ai.chat({
      message: '???�이?�그?�이 뭐야?',
      apiKey: 'sk-test-key-123456',
      provider: 'openai',
      model: 'gpt-4o-mini',
      document: baseDoc,
    })
    assert.equal(result.applied, false)
    assert.equal(result.document, undefined)
    assert.match(result.message, /질문/)
  })

  it('chat applies upsertColumns and returns document', async () => {
    globalThis.fetch = async () =>
      chatCompletion({
        message: '배송지 컬럼??추�??�어??,
        patch: {
          upsertColumns: [
            {
              tableId: 'tbl_orders',
              columns: [
                {
                  id: 'col_addr',
                  logicalName: '배송지',
                  physicalName: 'shipping_address',
                  type: 'varchar',
                  length: '255',
                  nn: true,
                },
              ],
            },
          ],
        },
      })
    const ai = new AiService()
    const result = await ai.chat({
      message: '주문??배송지 추�?',
      apiKey: 'sk-test-key-123456',
      provider: 'openai',
      model: 'gpt-4o-mini',
      document: baseDoc,
    })
    assert.equal(result.applied, true)
    assert.ok(result.document)
    assert.equal(result.document.notes[0]?.text, 'memo')
    const orders = result.document.tables.find((t) => t.id === 'tbl_orders')
    assert.ok(orders?.columns.some((c) => c.physicalName === 'shipping_address'))
  })

  it('chat maps insufficient quota to a Korean credit message', async () => {
    globalThis.fetch = async () =>
      jsonResponse(
        {
          error: {
            message: 'You exceeded your current quota',
            type: 'insufficient_quota',
            code: 'insufficient_quota',
          },
        },
        429,
      )
    const ai = new AiService()
    await assert.rejects(
      () =>
        ai.chat({
          message: '?�이�?추�?',
          apiKey: 'sk-test-key-123456',
          provider: 'openai',
          model: 'gpt-4o-mini',
          document: baseDoc,
        }),
      (err: unknown) => {
        assert.ok(err instanceof Error)
        assert.match(err.message, /?�레??)
        return true
      },
    )
  })

  it('rejects other provider without https baseUrl', async () => {
    const ai = new AiService()
    await assert.rejects(
      () =>
        ai.chat({
          message: 'hi',
          apiKey: 'nvidia-key-123456',
          provider: 'other',
          model: 'meta/llama-3.1-70b-instruct',
          document: baseDoc,
          baseUrl: 'http://example.com/v1',
        }),
      /https/,
    )
  })

  it('rejects chat documents over the table wire cap', async () => {
    const ai = new AiService()
    const tables = Array.from({ length: 401 }, (_, i) => ({
      ...baseDoc.tables[0]!,
      id: `tbl_${i}`,
      physicalName: `t_${i}`,
    }))
    await assert.rejects(
      () =>
        ai.chat({
          message: 'hi',
          apiKey: 'sk-test-key-123456',
          provider: 'openai',
          document: { ...baseDoc, tables },
        }),
      /400/,
    )
  })
})
