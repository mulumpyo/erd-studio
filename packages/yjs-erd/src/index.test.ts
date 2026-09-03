import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as Y from 'yjs'
import { sampleDocument, toDatabaseModel } from '@erd-studio/shared'
import {
  erdToY,
  layoutsMap,
  patchPosition,
  relationsMap,
  tablesMap,
  yToErd,
} from './index'

test('yjs roundtrip keeps table and column ids', () => {
  const doc = new Y.Doc()
  const source = sampleDocument()
  erdToY(doc, source)
  const loaded = yToErd(doc)
  assert.equal(loaded.tables[0].id, source.tables[0].id)
  assert.equal(loaded.tables[0].columns[0].id, source.tables[0].columns[0].id)
  assert.equal(loaded.relations[0].id, source.relations[0].id)
})

test('dragging a table updates layouts without changing the table map name', () => {
  const doc = new Y.Doc()
  const source = sampleDocument()
  erdToY(doc, source)
  const tableId = source.tables[0].id
  const beforeDb = toDatabaseModel(yToErd(doc))
  const nameBefore = tablesMap(doc).get(tableId)?.get('physicalName')
  patchPosition(doc, tableId, { x: 440, y: 280 })
  const layout = layoutsMap(doc).get(tableId)
  assert.equal(layout?.get('x'), 440)
  assert.equal(layout?.get('y'), 280)
  assert.equal(tablesMap(doc).get(tableId)?.get('physicalName'), nameBefore)
  assert.equal(tablesMap(doc).get(tableId)?.get('x'), source.tables[0].position.x)
  const moved = yToErd(doc)
  assert.deepEqual(moved.tables[0].position, { x: 440, y: 280 })
  assert.deepEqual(toDatabaseModel(moved), beforeDb)
})

test('documents that only store x/y on the table map still load', () => {
  const doc = new Y.Doc()
  const table = new Y.Map<unknown>()
  table.set('id', 'tbl_legacy')
  table.set('physicalName', 'users')
  table.set('logicalName', 'users')
  table.set('color', '#3b82f6')
  table.set('x', 12)
  table.set('y', 34)
  table.set('columns', new Y.Array())
  tablesMap(doc).set('tbl_legacy', table)
  const loaded = yToErd(doc)
  assert.equal(loaded.tables[0].id, 'tbl_legacy')
  assert.deepEqual(loaded.tables[0].position, { x: 12, y: 34 })
})

test('legacy yjs relations that point at table names are remapped', () => {
  const doc = new Y.Doc()
  const usersCols = new Y.Array<Y.Map<unknown>>()
  const idCol = new Y.Map<unknown>()
  idCol.set('physicalName', 'id')
  idCol.set('logicalName', 'id')
  idCol.set('type', 'int')
  idCol.set('pk', true)
  usersCols.push([idCol])
  const users = new Y.Map<unknown>()
  users.set('physicalName', 'users')
  users.set('logicalName', 'users')
  users.set('columns', usersCols)
  tablesMap(doc).set('tmp_users', users)

  const postsCols = new Y.Array<Y.Map<unknown>>()
  const fkCol = new Y.Map<unknown>()
  fkCol.set('physicalName', 'user_id')
  fkCol.set('logicalName', 'user_id')
  fkCol.set('type', 'int')
  fkCol.set('fk', true)
  postsCols.push([fkCol])
  const posts = new Y.Map<unknown>()
  posts.set('physicalName', 'posts')
  posts.set('logicalName', 'posts')
  posts.set('columns', postsCols)
  tablesMap(doc).set('tmp_posts', posts)

  const rel = new Y.Map<unknown>()
  rel.set('sourceTableId', 'users')
  rel.set('targetTableId', 'posts')
  rel.set('sourceColumnIds', ['id'])
  rel.set('targetColumnIds', ['user_id'])
  rel.set('kind', 'non-identifying')
  rel.set('sourceCardinality', '1')
  rel.set('targetCardinality', 'N')
  relationsMap(doc).set('rel_legacy', rel)

  const loaded = yToErd(doc)
  const usersTable = loaded.tables.find((table) => table.physicalName === 'users')
  const postsTable = loaded.tables.find((table) => table.physicalName === 'posts')
  assert.ok(usersTable && postsTable)
  assert.equal(loaded.relations[0].sourceTableId, usersTable.id)
  assert.equal(loaded.relations[0].targetTableId, postsTable.id)
  assert.equal(loaded.relations[0].sourceColumnIds[0], usersTable.columns[0].id)
  assert.equal(loaded.relations[0].targetColumnIds[0], postsTable.columns[0].id)
})

test('yjs roundtrip keeps schema ids on tables', () => {
  const ydoc = new Y.Doc()
  const source = sampleDocument()
  erdToY(ydoc, source)
  const loaded = yToErd(ydoc)
  assert.equal(loaded.schemas[0].id, source.schemas[0].id)
  assert.equal(loaded.tables[0].schemaId, source.tables[0].schemaId)
})

test('legacy yjs documents get a default schema', () => {
  const ydoc = new Y.Doc()
  const table = new Y.Map<unknown>()
  table.set('id', 'tbl_legacy')
  table.set('physicalName', 'users')
  table.set('logicalName', 'users')
  table.set('columns', new Y.Array())
  tablesMap(ydoc).set('tbl_legacy', table)
  const loaded = yToErd(ydoc)
  assert.equal(loaded.schemas.length, 1)
  assert.equal(loaded.tables[0].schemaId, loaded.schemas[0].id)
})
