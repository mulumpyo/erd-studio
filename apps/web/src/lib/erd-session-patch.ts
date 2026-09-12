import * as Y from 'yjs'
import type { ErdDocument, ErdNote, ErdRelation, ErdTable } from '@erd-studio/shared'
import {
  domainsMap,
  getNote,
  getRelation,
  getTable,
  layoutsMap,
  notesMap,
  readErdMeta,
  relationsMap,
  schemasMap,
  settingsMap,
  tablesMap,
} from '@erd-studio/yjs-erd'

export type ErdTouches = {
  tables: Set<string>
  layouts: Set<string>
  relations: Set<string>
  notes: Set<string>
  meta: boolean
}

export const collectErdTouches = (
  doc: Y.Doc,
  events: Y.YEvent<any>[],
): ErdTouches => {
  const tables = new Set<string>()
  const layouts = new Set<string>()
  const relations = new Set<string>()
  const notes = new Set<string>()
  let meta = false

  for (const event of events) {
    const target = event.target as { parent?: unknown }
    const parent = target.parent
    const keys = (event as Y.YMapEvent<unknown>).keysChanged as
      | Set<string>
      | undefined

    if (
      target === domainsMap(doc) ||
      target === schemasMap(doc) ||
      target === settingsMap(doc)
    ) {
      meta = true
      continue
    }
    if (parent === domainsMap(doc) || parent === schemasMap(doc)) {
      meta = true
      continue
    }

    if (target === tablesMap(doc) && keys) {
      for (const key of keys) tables.add(key)
      continue
    }
    if (target === layoutsMap(doc) && keys) {
      for (const key of keys) layouts.add(key)
      continue
    }
    if (target === relationsMap(doc) && keys) {
      for (const key of keys) relations.add(key)
      continue
    }
    if (target === notesMap(doc) && keys) {
      for (const key of keys) notes.add(key)
      continue
    }

    if (typeof event.path[0] === 'string') {
      const id = event.path[0]
      if (tablesMap(doc).has(id)) tables.add(id)
      else if (layoutsMap(doc).has(id)) layouts.add(id)
      else if (relationsMap(doc).has(id)) relations.add(id)
      else if (notesMap(doc).has(id)) notes.add(id)
    }
  }

  return { tables, layouts, relations, notes, meta }
}

const rebuildTables = (
  doc: Y.Doc,
  prev: ErdTable[],
  draggingIds: Set<string>,
): ErdTable[] => {
  const tables: ErdTable[] = []
  tablesMap(doc).forEach((_, id) => {
    const nextTable = getTable(doc, id)
    if (!nextTable) return
    if (draggingIds.has(id)) {
      const live = prev.find((t) => t.id === id)
      if (live) nextTable.position = { ...live.position }
    }
    tables.push(nextTable)
  })
  return tables
}

const rebuildRelations = (doc: Y.Doc): ErdRelation[] => {
  const relations: ErdRelation[] = []
  relationsMap(doc).forEach((_, id) => {
    const nextRel = getRelation(doc, id)
    if (nextRel) relations.push(nextRel)
  })
  return relations
}

const rebuildNotes = (
  doc: Y.Doc,
  prev: ErdNote[],
  draggingIds: Set<string>,
): ErdNote[] => {
  const notes: ErdNote[] = []
  notesMap(doc).forEach((_, id) => {
    const nextNote = getNote(doc, id)
    if (!nextNote) return
    if (draggingIds.has(id)) {
      const live = prev.find((n) => n.id === id)
      if (live) nextNote.position = { ...live.position }
    }
    notes.push(nextNote)
  })
  return notes
}

const patchTables = (
  doc: Y.Doc,
  prev: ErdTable[],
  touchedTables: Set<string>,
  touchedLayouts: Set<string>,
  draggingIds: Set<string>,
): ErdTable[] => {
  if (!touchedTables.size && !touchedLayouts.size) return prev

  if (touchedTables.size) {
    const tables = [...prev]
    for (const id of touchedTables) {
      const nextTable = getTable(doc, id)
      const idx = tables.findIndex((t) => t.id === id)
      if (!nextTable) {
        if (idx >= 0) tables.splice(idx, 1)
        continue
      }
      if (draggingIds.has(id)) {
        const live = prev.find((t) => t.id === id)
        if (live) nextTable.position = { ...live.position }
      }
      if (idx === -1) tables.push(nextTable)
      else tables[idx] = nextTable
    }
    if (tablesMap(doc).size !== tables.length) {
      return rebuildTables(doc, prev, draggingIds)
    }
    return tables.map((table) => {
      if (touchedTables.has(table.id)) return table
      return prev.find((t) => t.id === table.id) ?? table
    })
  }

  return prev.map((table) => {
    if (!touchedLayouts.has(table.id) || draggingIds.has(table.id)) return table
    const layout = layoutsMap(doc).get(table.id)
    if (!(layout instanceof Y.Map)) return table
    return {
      ...table,
      position: {
        x: Number(layout.get('x') ?? table.position.x),
        y: Number(layout.get('y') ?? table.position.y),
      },
      color: String(layout.get('color') ?? table.color),
    }
  })
}

const patchRelations = (
  doc: Y.Doc,
  prev: ErdRelation[],
  touched: Set<string>,
): ErdRelation[] => {
  if (!touched.size) return prev
  const relations = [...prev]
  for (const id of touched) {
    const nextRel = getRelation(doc, id)
    const idx = relations.findIndex((r) => r.id === id)
    if (!nextRel) {
      if (idx >= 0) relations.splice(idx, 1)
      continue
    }
    if (idx === -1) relations.push(nextRel)
    else relations[idx] = nextRel
  }
  if (relationsMap(doc).size !== relations.length) {
    return rebuildRelations(doc)
  }
  return relations.map((rel) => {
    if (touched.has(rel.id)) return rel
    return prev.find((r) => r.id === rel.id) ?? rel
  })
}

const patchNotes = (
  doc: Y.Doc,
  prev: ErdNote[],
  touched: Set<string>,
  draggingIds: Set<string>,
): ErdNote[] => {
  if (!touched.size) return prev
  const notes = [...prev]
  for (const id of touched) {
    const nextNote = getNote(doc, id)
    const idx = notes.findIndex((n) => n.id === id)
    if (!nextNote) {
      if (idx >= 0) notes.splice(idx, 1)
      continue
    }
    if (draggingIds.has(id)) {
      const live = prev.find((n) => n.id === id)
      if (live) nextNote.position = { ...live.position }
    }
    if (idx === -1) notes.push(nextNote)
    else notes[idx] = nextNote
  }
  if (notesMap(doc).size !== notes.length) {
    return rebuildNotes(doc, prev, draggingIds)
  }
  return notes.map((note) => {
    if (touched.has(note.id)) return note
    return prev.find((n) => n.id === note.id) ?? note
  })
}

/**
 * Y deep-observe 이벤트를 구조 패치로 적용해요.
 * 적용할 게 없으면(빈 이벤트·ERD 아님) null을 돌려줘요.
 */
export const applyErdStructuralPatch = (
  doc: Y.Doc,
  prev: ErdDocument,
  events: Y.YEvent<any>[],
  draggingIds: Set<string> = new Set(),
): ErdDocument | null => {
  const touches = collectErdTouches(doc, events)
  const hasStructural =
    touches.tables.size > 0 ||
    touches.layouts.size > 0 ||
    touches.relations.size > 0 ||
    touches.notes.size > 0

  if (!touches.meta && !hasStructural) {
    return null
  }

  const tables = hasStructural
    ? patchTables(
        doc,
        prev.tables,
        touches.tables,
        touches.layouts,
        draggingIds,
      )
    : prev.tables

  const relations = hasStructural
    ? patchRelations(doc, prev.relations, touches.relations)
    : prev.relations

  const notes = hasStructural
    ? patchNotes(doc, prev.notes, touches.notes, draggingIds)
    : prev.notes

  const meta = touches.meta ? readErdMeta(doc) : null

  if (
    tables === prev.tables &&
    relations === prev.relations &&
    notes === prev.notes &&
    !meta
  ) {
    return prev
  }

  return {
    ...prev,
    tables,
    relations,
    notes,
    ...(meta
      ? {
          domains: meta.domains,
          schemas: meta.schemas,
          settings: meta.settings,
        }
      : {}),
  }
}
