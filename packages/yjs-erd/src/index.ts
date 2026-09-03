import * as Y from 'yjs'
import {
  createId,
  emptyDocument,
  ensureDocumentIds,
  ensureStableId,
  normalizeViewSettings,
  orderTableColumns,
  type ErdColumn,
  type ErdDocument,
  type ErdDomain,
  type ErdNote,
  type ErdRelation,
  type ErdSchema,
  type ErdTable,
  type ErdViewPatch,
  type ErdViewSettings,
} from '@erd-studio/shared'

export type ChatLine = {
  id: string
  userId: string
  name: string
  email: string
  body: string
  createdAt: number
}

export const DRAG_ORIGIN = 'drag'

export const tablesMap = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>('tables')
export const relationsMap = (doc: Y.Doc) =>
  doc.getMap<Y.Map<unknown>>('relations')
export const notesMap = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>('notes')
export const domainsMap = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>('domains')
export const schemasMap = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>('schemas')
export const layoutsMap = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>('layouts')
export const settingsMap = (doc: Y.Doc) => doc.getMap<unknown>('settings')
export const chatArray = (doc: Y.Doc) => doc.getArray<Y.Map<unknown>>('chat')
export const aclMap = (doc: Y.Doc) => doc.getMap<string>('acl')

export const setAclRole = (doc: Y.Doc, userId: string, role: string | null) => {
  const map = aclMap(doc)
  if (role === null) map.delete(userId)
  else map.set(userId, role)
}

export const getAclRole = (doc: Y.Doc, userId: string) =>
  aclMap(doc).get(userId)

const setPlain = (map: Y.Map<unknown>, obj: Record<string, unknown>) => {
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) map.set(k, v)
  }
}

const columnToY = (col: ErdColumn) => {
  const m = new Y.Map<unknown>()
  setPlain(m, { ...col })
  return m
}

const tableToY = (table: ErdTable) => {
  const m = new Y.Map<unknown>()
  m.set('id', table.id)
  m.set('schemaId', table.schemaId)
  m.set('logicalName', table.logicalName)
  m.set('physicalName', table.physicalName)
  m.set('comment', table.comment ?? '')
  m.set('color', table.color)
  m.set('x', table.position.x)
  m.set('y', table.position.y)
  const cols = new Y.Array<Y.Map<unknown>>()
  cols.insert(0, orderTableColumns(table.columns).map(columnToY))
  m.set('columns', cols)
  return m
}

const schemaToY = (schema: ErdSchema) => {
  const m = new Y.Map<unknown>()
  setPlain(m, { id: schema.id, name: schema.name })
  return m
}

const relationToY = (rel: ErdRelation) => {
  const m = new Y.Map<unknown>()
  setPlain(m, { ...rel })
  return m
}

const noteToY = (note: ErdNote) => {
  const m = new Y.Map<unknown>()
  setPlain(m, {
    id: note.id,
    text: note.text,
    color: note.color,
    x: note.position.x,
    y: note.position.y,
    width: note.width,
    height: note.height,
  })
  return m
}

const domainToY = (domain: ErdDomain) => {
  const m = new Y.Map<unknown>()
  setPlain(m, { ...domain })
  return m
}

const yMapToObj = (map: Y.Map<unknown>) => {
  const out: Record<string, unknown> = {}
  map.forEach((v, k) => {
    out[k] = v
  })
  return out
}

const layoutToY = (
  position: { x: number; y: number },
  color?: string,
  size?: { width?: number; height?: number },
) => {
  const m = new Y.Map<unknown>()
  m.set('x', position.x)
  m.set('y', position.y)
  if (color) m.set('color', color)
  if (size?.width !== undefined) m.set('width', size.width)
  if (size?.height !== undefined) m.set('height', size.height)
  return m
}

const getOrCreateLayout = (doc: Y.Doc, id: string) => {
  const layouts = layoutsMap(doc)
  const existing = layouts.get(id)
  if (existing) return existing
  const table = tablesMap(doc).get(id)
  const created = new Y.Map<unknown>()
  created.set('x', table?.get('x') ?? 0)
  created.set('y', table?.get('y') ?? 0)
  created.set('color', table?.get('color') ?? '#3b82f6')
  layouts.set(id, created)
  return created
}

const yToTable = (
  map: Y.Map<unknown>,
  fallbackId: string,
  layout?: Y.Map<unknown>,
): ErdTable => {
  const raw = yMapToObj(map)
  const cols = map.get('columns')
  const id = ensureStableId(
    'tbl',
    String(raw.id || fallbackId || ''),
    `table:${fallbackId}`,
  )
  const columns: ErdColumn[] = []
  if (cols instanceof Y.Array) {
    cols.forEach((item, index) => {
      if (!(item instanceof Y.Map)) return
      const col = yMapToObj(item) as unknown as ErdColumn
      columns.push({
        ...col,
        id: ensureStableId(
          'col',
          col.id,
          `${id}:${index}:${col.physicalName ?? ''}`,
        ),
        domainId: col.domainId || undefined,
        defaultValue: col.defaultValue || undefined,
        comment: col.comment || undefined,
        length: col.length || undefined,
      })
    })
  }
  return {
    id,
    schemaId: String(raw.schemaId ?? ''),
    logicalName: String(raw.logicalName ?? ''),
    physicalName: String(raw.physicalName ?? ''),
    comment: raw.comment ? String(raw.comment) : undefined,
    color: String(layout?.get('color') ?? raw.color ?? '#3b82f6'),
    position: {
      x: Number(layout?.get('x') ?? raw.x ?? 0),
      y: Number(layout?.get('y') ?? raw.y ?? 0),
    },
    columns: orderTableColumns(columns),
  }
}

export const erdToY = (doc: Y.Doc, erd: ErdDocument) => {
  const next = ensureDocumentIds(erd)
  doc.transact(() => {
    const tables = tablesMap(doc)
    const relations = relationsMap(doc)
    const notes = notesMap(doc)
    const domains = domainsMap(doc)
    const schemas = schemasMap(doc)
    const layouts = layoutsMap(doc)
    for (const key of [...tables.keys()]) tables.delete(key)
    for (const key of [...relations.keys()]) relations.delete(key)
    for (const key of [...notes.keys()]) notes.delete(key)
    for (const key of [...domains.keys()]) domains.delete(key)
    for (const key of [...schemas.keys()]) schemas.delete(key)
    for (const key of [...layouts.keys()]) layouts.delete(key)
    for (const table of next.tables) {
      tables.set(table.id, tableToY(table))
      layouts.set(table.id, layoutToY(table.position, table.color))
    }
    for (const rel of next.relations) relations.set(rel.id, relationToY(rel))
    for (const note of next.notes) notes.set(note.id, noteToY(note))
    for (const domain of next.domains) domains.set(domain.id, domainToY(domain))
    for (const schema of next.schemas) schemas.set(schema.id, schemaToY(schema))
    const view = normalizeViewSettings(next.settings)
    const settings = settingsMap(doc)
    settings.set('nameMode', view.nameMode)
    settings.set('show', { ...view.show })
  })
}

export const yToErd = (doc: Y.Doc): ErdDocument => {
  const erd = emptyDocument()
  const layouts = layoutsMap(doc)
  tablesMap(doc).forEach((value, key) => {
    if (value instanceof Y.Map)
      erd.tables.push(yToTable(value, key, layouts.get(key)))
  })
  relationsMap(doc).forEach((value) => {
    if (value instanceof Y.Map) {
      const raw = yMapToObj(value) as unknown as ErdRelation
      erd.relations.push({
        ...raw,
        onDelete: raw.onDelete || undefined,
        onUpdate: raw.onUpdate || undefined,
      })
    }
  })
  notesMap(doc).forEach((value) => {
    if (value instanceof Y.Map) {
      const raw = yMapToObj(value)
      erd.notes.push({
        id: String(raw.id),
        text: String(raw.text ?? ''),
        color: String(raw.color ?? '#fef3c7'),
        position: { x: Number(raw.x ?? 0), y: Number(raw.y ?? 0) },
        width: Number(raw.width ?? 200),
        height: Number(raw.height ?? 120),
      })
    }
  })
  domainsMap(doc).forEach((value) => {
    if (value instanceof Y.Map)
      erd.domains.push(yMapToObj(value) as unknown as ErdDomain)
  })
  schemasMap(doc).forEach((value) => {
    if (value instanceof Y.Map) {
      const raw = yMapToObj(value)
      erd.schemas.push({
        id: String(raw.id ?? ''),
        name: String(raw.name ?? ''),
      })
    }
  })
  erd.settings = yToViewSettings(doc)
  return ensureDocumentIds(erd)
}

const yToViewSettings = (doc: Y.Doc): ErdViewSettings => {
  const map = settingsMap(doc)
  return normalizeViewSettings({
    nameMode: map.get('nameMode') as ErdViewSettings['nameMode'],
    show: map.get('show') as ErdViewSettings['show'],
  })
}

export const patchViewSettings = (
  doc: Y.Doc,
  patch: ErdViewPatch,
) => {
  const current = yToViewSettings(doc)
  const next = normalizeViewSettings({
    nameMode: patch.nameMode ?? current.nameMode,
    show: { ...current.show, ...patch.show },
  })
  const map = settingsMap(doc)
  map.set('nameMode', next.nameMode)
  map.set('show', { ...next.show })
}

export const yToChat = (doc: Y.Doc): ChatLine[] => {
  const lines: ChatLine[] = []
  chatArray(doc).forEach((item) => {
    if (!(item instanceof Y.Map)) return
    const raw = yMapToObj(item)
    lines.push({
      id: String(raw.id),
      userId: String(raw.userId ?? ''),
      name: String(raw.name ?? ''),
      email: String(raw.email ?? ''),
      body: String(raw.body ?? ''),
      createdAt: Number(raw.createdAt ?? Date.now()),
    })
  })
  return lines
}

export const pushChat = (
  doc: Y.Doc,
  line: Omit<ChatLine, 'id' | 'createdAt'> & Partial<ChatLine>,
) => {
  const m = new Y.Map<unknown>()
  setPlain(m, {
    id: line.id ?? createId('msg'),
    userId: line.userId,
    name: line.name,
    email: line.email ?? '',
    body: line.body,
    createdAt: line.createdAt ?? Date.now(),
  })
  chatArray(doc).push([m])
}

export const seedIfEmpty = (
  doc: Y.Doc,
  snapshot: ErdDocument | null | undefined,
) => {
  if (tablesMap(doc).size > 0) return
  if (!snapshot) return
  erdToY(doc, snapshot)
}

export const upsertTable = (doc: Y.Doc, table: ErdTable) => {
  doc.transact(() => {
    tablesMap(doc).set(table.id, tableToY(table))
    layoutsMap(doc).set(table.id, layoutToY(table.position, table.color))
  })
}

export const patchTable = (
  doc: Y.Doc,
  id: string,
  patch: Partial<ErdTable>,
) => {
  const table = tablesMap(doc).get(id)
  if (!table) return
  doc.transact(() => {
    if (patch.logicalName !== undefined)
      table.set('logicalName', patch.logicalName)
    if (patch.physicalName !== undefined)
      table.set('physicalName', patch.physicalName)
    if (patch.comment !== undefined) table.set('comment', patch.comment)
    if (patch.schemaId !== undefined) table.set('schemaId', patch.schemaId)
    if (patch.color !== undefined) getOrCreateLayout(doc, id).set('color', patch.color)
    if (patch.position) {
      const layout = getOrCreateLayout(doc, id)
      layout.set('x', patch.position.x)
      layout.set('y', patch.position.y)
    }
    if (patch.columns) {
      const cols = new Y.Array<Y.Map<unknown>>()
      cols.insert(0, orderTableColumns(patch.columns).map(columnToY))
      table.set('columns', cols)
    }
  })
}

export const patchPosition = (
  doc: Y.Doc,
  id: string,
  position: { x: number; y: number },
  origin: unknown = DRAG_ORIGIN,
) => {
  if (tablesMap(doc).has(id)) {
    doc.transact(() => {
      const layout = getOrCreateLayout(doc, id)
      layout.set('x', position.x)
      layout.set('y', position.y)
    }, origin)
    return
  }
  const node = notesMap(doc).get(id)
  if (!node) return
  doc.transact(() => {
    node.set('x', position.x)
    node.set('y', position.y)
  }, origin)
}

export const removeTable = (doc: Y.Doc, id: string) => {
  doc.transact(() => {
    tablesMap(doc).delete(id)
    layoutsMap(doc).delete(id)
    const rels = relationsMap(doc)
    for (const [key, value] of rels.entries()) {
      if (!(value instanceof Y.Map)) continue
      if (
        value.get('sourceTableId') === id ||
        value.get('targetTableId') === id
      )
        rels.delete(key)
    }
  })
}

export const upsertRelation = (doc: Y.Doc, rel: ErdRelation) => {
  relationsMap(doc).set(rel.id, relationToY(rel))
}

export const removeRelation = (doc: Y.Doc, id: string) => {
  relationsMap(doc).delete(id)
}

export const upsertNote = (doc: Y.Doc, note: ErdNote) => {
  notesMap(doc).set(note.id, noteToY(note))
}

export const patchNote = (doc: Y.Doc, id: string, patch: Partial<ErdNote>) => {
  const note = notesMap(doc).get(id)
  if (!note) return
  doc.transact(() => {
    if (patch.text !== undefined) note.set('text', patch.text)
    if (patch.color !== undefined) note.set('color', patch.color)
    if (patch.width !== undefined) note.set('width', patch.width)
    if (patch.height !== undefined) note.set('height', patch.height)
    if (patch.position) {
      note.set('x', patch.position.x)
      note.set('y', patch.position.y)
    }
  })
}

export const removeNote = (doc: Y.Doc, id: string) => {
  notesMap(doc).delete(id)
}

export const upsertDomain = (doc: Y.Doc, domain: ErdDomain) => {
  doc.transact(() => {
    domainsMap(doc).set(domain.id, domainToY(domain))
    tablesMap(doc).forEach((table) => {
      if (!(table instanceof Y.Map)) return
      const cols = table.get('columns')
      if (!(cols instanceof Y.Array)) return
      cols.forEach((col) => {
        if (!(col instanceof Y.Map)) return
        if (col.get('domainId') !== domain.id) return
        col.set('type', domain.type)
        if (domain.length) col.set('length', domain.length)
        else col.set('length', '')
        col.set('nn', domain.nn)
      })
    })
  })
}

export const removeDomain = (doc: Y.Doc, id: string) => {
  doc.transact(() => {
    domainsMap(doc).delete(id)
    tablesMap(doc).forEach((table) => {
      if (!(table instanceof Y.Map)) return
      const cols = table.get('columns')
      if (!(cols instanceof Y.Array)) return
      cols.forEach((col) => {
        if (!(col instanceof Y.Map)) return
        if (col.get('domainId') === id) col.set('domainId', '')
      })
    })
  })
}

export const isDocEmpty = (doc: Y.Doc) =>
  tablesMap(doc).size === 0 && notesMap(doc).size === 0
