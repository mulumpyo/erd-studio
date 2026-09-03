import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sampleDocument } from './index'
import {
  captureVersionSnapshot,
  databaseModelFromVersionSnapshot,
  documentFromVersionSnapshot,
  normalizeVersionSnapshot,
} from './version-snapshot'

test('version snapshots stay frozen after the live document changes', () => {
  const live = sampleDocument()
  const frozen = captureVersionSnapshot(live)
  const tableId = live.tables[0].id
  const nameBefore = live.tables[0].physicalName
  const xBefore = live.tables[0].position.x
  live.tables[0].physicalName = 'members'
  live.tables[0].position = { x: 900, y: 640 }
  assert.equal(
    frozen.databaseModel.tables.find((table) => table.id === tableId)
      ?.physicalName,
    nameBefore,
  )
  assert.equal(
    frozen.canvas.tables.find((table) => table.tableId === tableId)?.position.x,
    xBefore,
  )
  assert.notEqual(live.tables[0].physicalName, nameBefore)
})

test('legacy named version documents become split snapshots', () => {
  const legacy = sampleDocument()
  delete (legacy as { schemas?: unknown }).schemas
  const snapshot = normalizeVersionSnapshot({
    tables: legacy.tables,
    relations: legacy.relations,
    notes: legacy.notes,
    domains: legacy.domains,
    settings: legacy.settings,
  })
  assert.equal(snapshot.kind, 'erd-studio-version')
  assert.ok(snapshot.databaseModel.tables.length)
  assert.ok(snapshot.canvas.tables.length)
  assert.equal(
    snapshot.databaseModel.tables[0].id,
    snapshot.canvas.tables[0].tableId,
  )
})

test('a version snapshot can restore an erd document without live edits', () => {
  const live = sampleDocument()
  const frozen = captureVersionSnapshot(live)
  live.tables[0].physicalName = 'members'
  live.tables[0].position = { x: 12, y: 34 }
  const restored = documentFromVersionSnapshot(frozen)
  assert.equal(restored.tables[0].physicalName, 'users')
  assert.deepEqual(restored.tables[0].position, sampleDocument().tables[0].position)
  assert.deepEqual(
    databaseModelFromVersionSnapshot(frozen).tables[0],
    frozen.databaseModel.tables[0],
  )
})
