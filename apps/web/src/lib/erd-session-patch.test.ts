import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { sampleDocument, defaultNote } from '@erd-studio/shared'
import {
  erdToY,
  patchPosition,
  patchTable,
  patchViewSettings,
  upsertDomain,
  upsertNote,
  upsertRelation,
  yToErd,
} from '@erd-studio/yjs-erd'
import { applyErdStructuralPatch } from './erd-session-patch'

const captureEvents = (doc: Y.Doc, mutate: () => void) => {
  const events: Y.YEvent<any>[] = []
  const maps = [
    doc.getMap('tables'),
    doc.getMap('relations'),
    doc.getMap('notes'),
    doc.getMap('layouts'),
    doc.getMap('domains'),
    doc.getMap('schemas'),
    doc.getMap('settings'),
  ]
  const handler = (batch: Y.YEvent<any>[]) => {
    events.push(...batch)
  }
  for (const map of maps) map.observeDeep(handler)
  mutate()
  for (const map of maps) map.unobserveDeep(handler)
  return events
}

describe('erd-session-patch (useErdSession core)', () => {
  it('patches a single table without replacing untouched table identity', () => {
    const doc = new Y.Doc()
    const source = sampleDocument()
    erdToY(doc, source)
    const prev = yToErd(doc)
    const untouched = prev.tables[1]
    const targetId = prev.tables[0].id

    const events = captureEvents(doc, () => {
      patchTable(doc, targetId, { logicalName: 'renamed' })
    })
    const next = applyErdStructuralPatch(doc, prev, events)
    expect(next).not.toBeNull()
    expect(next!.tables.find((t) => t.id === targetId)?.logicalName).toBe(
      'renamed',
    )
    expect(next!.tables.find((t) => t.id === untouched.id)).toBe(untouched)
  })

  it('patches relation-only updates without rematerializing tables', () => {
    const doc = new Y.Doc()
    const source = sampleDocument()
    erdToY(doc, source)
    const prev = yToErd(doc)
    const tableRef = prev.tables[0]
    const rel = prev.relations[0]

    const events = captureEvents(doc, () => {
      upsertRelation(doc, { ...rel, targetCardinality: '1' })
    })
    const next = applyErdStructuralPatch(doc, prev, events)
    expect(next).not.toBeNull()
    expect(next!.relations[0].targetCardinality).toBe('1')
    expect(next!.tables[0]).toBe(tableRef)
  })

  it('patches note-only updates', () => {
    const doc = new Y.Doc()
    const source = sampleDocument()
    erdToY(doc, source)
    const note = defaultNote({ text: 'hello', position: { x: 10, y: 20 } })
    upsertNote(doc, note)
    const prev = yToErd(doc)
    const tableRef = prev.tables[0]

    const events = captureEvents(doc, () => {
      upsertNote(doc, { ...note, text: 'updated' })
    })
    const next = applyErdStructuralPatch(doc, prev, events)
    expect(next).not.toBeNull()
    expect(next!.notes.find((n) => n.id === note.id)?.text).toBe('updated')
    expect(next!.tables[0]).toBe(tableRef)
  })

  it('preserves local drag position across remote layout patch', () => {
    const doc = new Y.Doc()
    const source = sampleDocument()
    erdToY(doc, source)
    const prev = yToErd(doc)
    const id = prev.tables[0].id
    prev.tables[0].position = { x: 999, y: 888 }

    const events = captureEvents(doc, () => {
      patchPosition(doc, id, { x: 1, y: 2 })
    })
    const next = applyErdStructuralPatch(doc, prev, events, new Set([id]))
    expect(next).not.toBeNull()
    expect(next!.tables[0].position).toEqual({ x: 999, y: 888 })
  })

  it('does not treat chat-only docs as ERD touches (empty events → null)', () => {
    const doc = new Y.Doc()
    erdToY(doc, sampleDocument())
    const prev = yToErd(doc)
    expect(applyErdStructuralPatch(doc, prev, [])).toBeNull()
  })

  it('patches domains/settings meta without full rematerialize of tables', () => {
    const doc = new Y.Doc()
    const source = sampleDocument()
    erdToY(doc, source)
    const prev = yToErd(doc)
    const tableRef = prev.tables[0]

    const events = captureEvents(doc, () => {
      upsertDomain(doc, {
        id: 'dom_new',
        name: '금액',
        type: 'decimal',
        nn: false,
      })
      patchViewSettings(doc, { nameMode: 'physical' })
    })
    const next = applyErdStructuralPatch(doc, prev, events)
    expect(next).not.toBeNull()
    expect(next!.tables[0]).toBe(tableRef)
    expect(next!.domains.some((d) => d.id === 'dom_new')).toBe(true)
    expect(next!.settings.nameMode).toBe('physical')
  })

  it('heals table size mismatch by rebuilding from Y maps', () => {
    const doc = new Y.Doc()
    erdToY(doc, sampleDocument())
    const prev = yToErd(doc)
    const tableRef = prev.tables[1]
    // Y에는 이미 있는데 prev에는 없는 원격 추가 테이블 id를 흉내 내요.
    const stale = {
      ...prev,
      tables: prev.tables.slice(0, 1),
    }
    const events = captureEvents(doc, () => {
      patchTable(doc, prev.tables[0].id, { logicalName: 'patched' })
    })
    // 크기 불일치 경로: prev 테이블 1개, Y는 더 많고, touch에 기존 id가 들어가요.
    const next = applyErdStructuralPatch(doc, stale, events)
    expect(next).not.toBeNull()
    expect(next!.tables.length).toBe(prev.tables.length)
    expect(next!.tables.find((t) => t.id === tableRef.id)?.id).toBe(tableRef.id)
    expect(next!.tables.find((t) => t.id === prev.tables[0].id)?.logicalName).toBe(
      'patched',
    )
  })
})
