import * as Y from 'yjs'
import type { ErdDocument, ErdNote, ErdRelation, ErdTable } from '@erd-studio/shared'
import {
  domainsMap,
  getNote,
  getRelation,
  getTable,
  layoutsMap,
  notesMap,
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

const patchTables = (
  doc: Y.Doc,
  prev: ErdTable[],
  touchedTables: Set<string>,
  touchedLayouts: Set<string>,
  draggingIds: Set<string>,
): ErdTable[] | null => {
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
    if (tablesMap(doc).size !== tables.length) return null
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
): ErdRelation[] | null => {
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
  if (relationsMap(doc).size !== relations.length) return null
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
): ErdNote[] | null => {
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
  if (notesMap(doc).size !== notes.length) return null
  return notes.map((note) => {
    if (touched.has(note.id)) return note
    return prev.find((n) => n.id === note.id) ?? note
  })
}

/**
 * Apply Y deep-observe events as structural patches.
 * Returns null when a full yToErd rematerialize is required.
 */
export const applyErdStructuralPatch = (
  doc: Y.Doc,
  prev: ErdDocument,
  events: Y.YEvent<any>[],
  draggingIds: Set<string> = new Set(),
): ErdDocument | null => {
  const touches = collectErdTouches(doc, events)
  if (touches.meta) return null
  if (
    !touches.tables.size &&
    !touches.layouts.size &&
    !touches.relations.size &&
    !touches.notes.size
  ) {
    return null
  }

  const tables = patchTables(
    doc,
    prev.tables,
    touches.tables,
    touches.layouts,
    draggingIds,
  )
  if (!tables) return null

  const relations = patchRelations(doc, prev.relations, touches.relations)
  if (!relations) return null

  const notes = patchNotes(doc, prev.notes, touches.notes, draggingIds)
  if (!notes) return null

  if (
    tables === prev.tables &&
    relations === prev.relations &&
    notes === prev.notes
  ) {
    return prev
  }

  return {
    ...prev,
    tables,
    relations,
    notes,
  }
}
