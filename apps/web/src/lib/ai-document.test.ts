import { describe, expect, it } from 'vitest'
import { emptyDocument, type ErdDocument } from '@erd-studio/shared'
import { toAiRequestDocument } from '@/lib/ai-document'

const sample = (): ErdDocument => ({
  ...emptyDocument(),
  notes: [
    {
      id: 'note_1',
      text: 'keep',
      color: '#fef3c7',
      position: { x: 0, y: 0 },
      width: 120,
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
          id: 'col_id',
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
        {
          id: 'col_name',
          logicalName: '이름',
          physicalName: 'name',
          type: 'varchar',
          length: '120',
          pk: false,
          fk: false,
          nn: false,
          unique: false,
          autoIncrement: false,
        },
      ],
    },
  ],
  relations: [],
})

describe('toAiRequestDocument', () => {
  it('keeps notes and omits false column flags', () => {
    const slim = toAiRequestDocument(sample())
    expect(slim.notes[0]?.text).toBe('keep')
    const pk = slim.tables[0]?.columns[0] as Record<string, unknown>
    const name = slim.tables[0]?.columns[1] as Record<string, unknown>
    expect(pk.pk).toBe(true)
    expect(pk.nn).toBe(true)
    expect(pk.autoIncrement).toBe(true)
    expect(name.pk).toBeUndefined()
    expect(name.fk).toBeUndefined()
    expect(name.nn).toBeUndefined()
    expect(name.length).toBe('120')
  })

  it('omits empty schemaId from tables', () => {
    const slim = toAiRequestDocument(sample())
    expect(slim.tables[0]).not.toHaveProperty('schemaId')
  })
})
