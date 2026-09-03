import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultTable, emptyDocument, sampleDocument } from './index'
import { parseErdFile, stringifyErdFile } from './erd-file'
import { toDatabaseModel } from './database-model'
import { fromModels, toCanvasModel } from './canvas-model'
import { ensureDocumentIds } from './migrate-document'

test('legacy documents without ids get stable ids on load', () => {
  const raw = JSON.stringify({
    kind: 'erd-studio',
    version: 1,
    document: {
      tables: [
        {
          physicalName: 'users',
          logicalName: '사용자',
          columns: [{ physicalName: 'id', type: 'int', pk: true }],
        },
      ],
      relations: [],
    },
  })
  const first = parseErdFile(raw)
  const second = parseErdFile(raw)
  assert.ok(first.tables[0].id.startsWith('tbl_'))
  assert.ok(first.tables[0].columns[0].id.startsWith('col_'))
  assert.equal(first.tables[0].id, second.tables[0].id)
  assert.equal(first.tables[0].columns[0].id, second.tables[0].columns[0].id)
})

test('existing .erd.json ids are preserved through stringify/parse', () => {
  const doc = sampleDocument()
  const tableId = doc.tables[0].id
  const columnId = doc.tables[0].columns[0].id
  const roundtrip = parseErdFile(stringifyErdFile(doc, 'blog'))
  assert.equal(roundtrip.tables[0].id, tableId)
  assert.equal(roundtrip.tables[0].columns[0].id, columnId)
  assert.equal(roundtrip.tables[0].physicalName, 'users')
})

test('renaming a table does not change its id or column ids', () => {
  const doc = ensureDocumentIds(sampleDocument())
  const table = doc.tables[0]
  const ids = {
    table: table.id,
    columns: table.columns.map((col) => col.id),
  }
  table.physicalName = 'members'
  table.logicalName = '멤버'
  const next = toDatabaseModel(doc)
  assert.equal(next.tables[0].id, ids.table)
  assert.deepEqual(
    next.columns.filter((col) => col.tableId === ids.table).map((col) => col.id),
    ids.columns,
  )
  assert.equal(next.primaryKeys[0].id, `pk_${ids.table}`)
  assert.equal(next.tables[0].physicalName, 'members')
})

test('moving a table does not change the database model', () => {
  const doc = sampleDocument()
  const before = toDatabaseModel(doc)
  doc.tables[0].position = { x: 900, y: 640 }
  doc.tables[0].color = '#ef4444'
  const after = toDatabaseModel(doc)
  assert.deepEqual(after, before)
  assert.equal(toCanvasModel(doc).tables[0].position.x, 900)
  assert.equal(toCanvasModel(doc).tables[0].color, '#ef4444')
})

test('fromModels roundtrip keeps database ids and canvas positions', () => {
  const doc = sampleDocument()
  const restored = fromModels(toDatabaseModel(doc), toCanvasModel(doc))
  assert.deepEqual(
    restored.tables.map((table) => ({
      id: table.id,
      physicalName: table.physicalName,
      position: table.position,
      columnIds: table.columns.map((col) => col.id),
    })),
    doc.tables.map((table) => ({
      id: table.id,
      physicalName: table.physicalName,
      position: table.position,
      columnIds: table.columns.map((col) => col.id),
    })),
  )
  assert.equal(restored.relations[0].id, doc.relations[0].id)
})

test('database model exposes stable pk / fk / unique index ids', () => {
  const doc = sampleDocument()
  const model = toDatabaseModel(doc)
  assert.ok(model.primaryKeys.length)
  assert.equal(model.primaryKeys[0].id, `pk_${doc.tables[0].id}`)
  assert.equal(model.foreignKeys[0].id, doc.relations[0].id)
  const email = doc.tables[0].columns.find((col) => col.physicalName === 'email')
  assert.ok(email)
  assert.equal(
    model.indexes.find((item) => item.columnIds.includes(email.id))?.id,
    `uq_${email.id}`,
  )
})

test('new tables keep a stable id independent of the default name', () => {
  const table = defaultTable()
  const id = table.id
  table.physicalName = 'orders'
  assert.equal(table.id, id)
})

test('legacy relations remap to newly assigned table and column ids', () => {
  const raw = JSON.stringify({
    kind: 'erd-studio',
    version: 1,
    document: {
      tables: [
        {
          physicalName: 'users',
          logicalName: 'users',
          columns: [{ physicalName: 'id', type: 'int', pk: true }],
        },
        {
          physicalName: 'posts',
          logicalName: 'posts',
          columns: [
            { physicalName: 'id', type: 'int', pk: true },
            { physicalName: 'user_id', type: 'int', fk: true },
          ],
        },
      ],
      relations: [
        {
          sourceTableId: 'users',
          targetTableId: 'posts',
          sourceColumnIds: ['id'],
          targetColumnIds: ['user_id'],
          kind: 'non-identifying',
          sourceCardinality: '1',
          targetCardinality: 'N',
        },
      ],
    },
  })
  const doc = parseErdFile(raw)
  const users = doc.tables.find((table) => table.physicalName === 'users')
  const posts = doc.tables.find((table) => table.physicalName === 'posts')
  assert.ok(users && posts)
  assert.ok(users.id.startsWith('tbl_'))
  assert.notEqual(users.id, 'users')
  assert.equal(doc.relations[0].sourceTableId, users.id)
  assert.equal(doc.relations[0].targetTableId, posts.id)
  assert.equal(
    doc.relations[0].sourceColumnIds[0],
    users.columns.find((col) => col.physicalName === 'id')?.id,
  )
  assert.equal(
    doc.relations[0].targetColumnIds[0],
    posts.columns.find((col) => col.physicalName === 'user_id')?.id,
  )
})

test('legacy documents get a default schema and tables belong to it', () => {
  const raw = JSON.stringify({
    kind: 'erd-studio',
    version: 1,
    document: {
      tables: [
        {
          physicalName: 'users',
          columns: [{ physicalName: 'id', type: 'int', pk: true }],
        },
      ],
    },
  })
  const first = parseErdFile(raw)
  const second = parseErdFile(raw)
  assert.equal(first.schemas.length, 1)
  assert.equal(first.schemas[0].name, '')
  assert.ok(first.schemas[0].id.startsWith('sch_'))
  assert.equal(first.tables[0].schemaId, first.schemas[0].id)
  assert.equal(first.schemas[0].id, second.schemas[0].id)
  assert.equal(toDatabaseModel(first).tables[0].schemaId, first.schemas[0].id)
})

test('schema rename keeps the schema id and table membership', () => {
  const doc = ensureDocumentIds(sampleDocument())
  const schemaId = doc.schemas[0].id
  const tableId = doc.tables[0].id
  doc.schemas[0].name = 'billing'
  const model = toDatabaseModel(doc)
  assert.equal(model.schemas[0].id, schemaId)
  assert.equal(model.tables[0].schemaId, schemaId)
  assert.equal(model.tables[0].id, tableId)
  assert.equal(model.schemas[0].name, 'billing')
})

test('legacy domain names are remapped onto columns', () => {
  const base = emptyDocument()
  const doc = ensureDocumentIds({
    ...base,
    tables: [
      {
        id: 'tbl_users',
        schemaId: '',
        physicalName: 'users',
        logicalName: 'users',
        color: '#3b82f6',
        position: { x: 0, y: 0 },
        columns: [
          {
            id: 'col_email',
            physicalName: 'email',
            logicalName: 'email',
            type: 'varchar',
            pk: false,
            fk: false,
            nn: false,
            unique: false,
            autoIncrement: false,
            domainId: 'email',
          },
        ],
      },
    ],
    domains: [{ id: '', name: 'email', type: 'varchar', length: '255', nn: true }],
  })
  assert.ok(doc.domains[0].id.startsWith('dom_'))
  assert.notEqual(doc.domains[0].id, 'email')
  assert.equal(doc.tables[0].columns[0].domainId, doc.domains[0].id)
})
