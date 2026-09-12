import {
  normalizeDocument,
  type ErdColumn,
  type ErdDocument,
  type ErdRelation,
  type ErdTable,
} from '@erd-studio/shared'
import { sanitizeAiDocument } from './ai-local'

const DETAIL_TABLE_CAP = 6
const SMALL_DOC_ALL = 6
const HISTORY_LIMIT = 6
const HISTORY_CHARS = 800
const COLUMN_DETAIL_CAP = 40
const DEIXIS_RE =
  /그거|그것|해당|방금|위에|아까|이전|이거|저거|그\s*테이블|이\s*테이블/u

export type CompactColumn = {
  id: string
  logicalName: string
  physicalName: string
  type: string
  length?: string | null
  pk?: boolean
  fk?: boolean
  nn?: boolean
  unique?: boolean
  autoIncrement?: boolean
}

export type CompactTable = {
  id: string
  schemaId?: string
  logicalName: string
  physicalName: string
  position: { x: number; y: number }
  columns: CompactColumn[]
}

export type CompactRelation = {
  id: string
  sourceTableId: string
  targetTableId: string
  sourceColumnIds: string[]
  targetColumnIds: string[]
  kind?: string
  sourceCardinality?: string
  targetCardinality?: string
}

export type AiColumnPatch = {
  tableId?: string
  columns?: unknown[]
  removeColumnIds?: unknown
}

export type AiChatPatch = {
  upsertTables?: unknown[]
  removeTableIds?: string[]
  upsertColumns?: AiColumnPatch[]
  upsertRelations?: unknown[]
  removeRelationIds?: string[]
}

export const compactColumn = (
  col: ErdTable['columns'][number],
): CompactColumn => {
  const out: CompactColumn = {
    id: col.id,
    logicalName: col.logicalName,
    physicalName: col.physicalName,
    type: col.type,
  }
  if (col.length != null && col.length !== '') out.length = col.length
  if (col.pk) out.pk = true
  if (col.fk) out.fk = true
  if (col.nn) out.nn = true
  if (col.unique) out.unique = true
  if (col.autoIncrement) out.autoIncrement = true
  return out
}

export const compactTable = (
  table: ErdTable,
  columnCap = COLUMN_DETAIL_CAP,
): CompactTable => ({
  id: table.id,
  ...(table.schemaId ? { schemaId: table.schemaId } : {}),
  logicalName: table.logicalName,
  physicalName: table.physicalName,
  position: table.position,
  columns: table.columns.slice(0, columnCap).map(compactColumn),
})

export const compactRelation = (rel: ErdRelation): CompactRelation => ({
  id: rel.id,
  sourceTableId: rel.sourceTableId,
  targetTableId: rel.targetTableId,
  sourceColumnIds: rel.sourceColumnIds,
  targetColumnIds: rel.targetColumnIds,
  ...(rel.kind ? { kind: rel.kind } : {}),
  ...(rel.sourceCardinality
    ? { sourceCardinality: rel.sourceCardinality }
    : {}),
  ...(rel.targetCardinality
    ? { targetCardinality: rel.targetCardinality }
    : {}),
})

/** chat/generate 요청용으로 가볍게 만든 ERD예요 (서버가 notes를 보존하려고 남겨 둬요). */
export const compactDocumentForWire = (doc: ErdDocument) => ({
  schemas: doc.schemas,
  tables: doc.tables.map((table) => ({
    id: table.id,
    ...(table.schemaId ? { schemaId: table.schemaId } : {}),
    logicalName: table.logicalName,
    physicalName: table.physicalName,
    color: table.color,
    position: table.position,
    columns: table.columns.map(compactColumn),
  })),
  relations: doc.relations.map(compactRelation),
  notes: doc.notes,
  domains: doc.domains,
  settings: doc.settings,
})

const normalizeNeedle = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\s_\-./]+/g, '')
    .replace(/테이블|table|컬럼|column/gi, '')

const stripKoreanParticle = (token: string) =>
  token.replace(
    /(으로|에서|에게|까지|부터|이나|이|가|을|를|은|는|에|의|만|도|로)$/u,
    '',
  )

const requestTokens = (text: string) => {
  const raw = text
    .split(/[^\w가-힣]+/i)
    .map(normalizeNeedle)
    .filter((token) => token.length >= 2)
  const out = new Set<string>()
  for (const token of raw) {
    out.add(token)
    const stem = stripKoreanParticle(token)
    if (stem.length >= 2) out.add(stem)
  }
  return [...out]
}

const nameMatchesToken = (name: string, tokens: string[], haystack: string) => {
  if (tokens.includes(name)) return true
  if (/^[a-z][a-z0-9]*$/.test(name) && haystack.includes(name)) return true
  // 길이가 같은 이름에서 한 글자 오타도 봐해요 (주문/주먼).
  if (
    name.length >= 2 &&
    tokens.some(
      (token) =>
        token.length === name.length && editDistance(name, token) <= 1,
    )
  ) {
    return true
  }
  return false
}

const editDistance = (a: string, b: string) => {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 1) return 99
  if (a.length > b.length) return editDistance(b, a)
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1
      j += 1
      continue
    }
    edits += 1
    if (edits > 1) return edits
    if (a.length === b.length) {
      i += 1
      j += 1
    } else {
      j += 1
    }
  }
  edits += a.length - i + (b.length - j)
  return edits
}

const collectNameHits = (doc: ErdDocument, text: string) => {
  const tokens = requestTokens(text)
  const haystack = normalizeNeedle(text)
  const matched = new Set<string>()
  for (const table of doc.tables) {
    const names = [
      table.logicalName,
      table.physicalName,
      ...table.columns.map((c) => c.logicalName),
      ...table.columns.map((c) => c.physicalName),
    ]
      .map(normalizeNeedle)
      .filter((name) => name.length >= 2)
    if (names.some((name) => nameMatchesToken(name, tokens, haystack))) {
      matched.add(table.id)
    }
  }
  return matched
}

/** 요청 글에 나온 테이블 id를 고르고, 관계로 이웃까지 넓혀요. */
export const selectRelatedTableIds = (
  doc: ErdDocument,
  text: string,
  limit = DETAIL_TABLE_CAP,
): string[] => {
  if (doc.tables.length <= SMALL_DOC_ALL) {
    return doc.tables.map((t) => t.id)
  }
  const matched = collectNameHits(doc, text)
  // 대명사·지시어면 앞선 대화에 나온 이름을 참고해요.
  if (!matched.size && DEIXIS_RE.test(text)) {
    const parts = text.split('\n')
    for (let i = parts.length - 1; i >= 0 && matched.size === 0; i -= 1) {
      if (DEIXIS_RE.test(parts[i] || '') && parts[i] === text.trim()) continue
      for (const id of collectNameHits(doc, parts[i] || '')) matched.add(id)
    }
  }
  if (!matched.size) {
    return doc.tables
      .slice(0, Math.min(limit, doc.tables.length))
      .map((t) => t.id)
  }
  for (const rel of doc.relations) {
    if (matched.has(rel.sourceTableId)) matched.add(rel.targetTableId)
    if (matched.has(rel.targetTableId)) matched.add(rel.sourceTableId)
  }
  return doc.tables
    .map((t) => t.id)
    .filter((id) => matched.has(id))
    .slice(0, limit)
}

export const buildChatContext = (
  doc: ErdDocument,
  requestText: string,
  historyText = '',
) => {
  const combined = `${historyText}\n${requestText}`.trim()
  const detailIds = new Set(selectRelatedTableIds(doc, combined))
  // 마지막 말이 지시어면 대화 기록을 먼저, 그다음 지금 요청을 봐요.
  if (DEIXIS_RE.test(requestText)) {
    for (const id of selectRelatedTableIds(doc, historyText || requestText)) {
      detailIds.add(id)
    }
  }
  const index = doc.tables.map((t) => ({
    id: t.id,
    logicalName: t.logicalName,
    physicalName: t.physicalName,
  }))
  const tables = doc.tables
    .filter((t) => detailIds.has(t.id))
    .map((t) => compactTable(t))
  const relations = doc.relations
    .filter(
      (r) => detailIds.has(r.sourceTableId) || detailIds.has(r.targetTableId),
    )
    .map(compactRelation)
  return {
    tableIndex: index,
    detailTableIds: [...detailIds],
    tables,
    relations,
    truncated: detailIds.size < doc.tables.length,
  }
}

export const trimChatHistory = (
  history: Array<{ role: 'user' | 'assistant'; content: string }> | undefined,
) =>
  (history || [])
    .filter((item) => item.content?.trim())
    .slice(-HISTORY_LIMIT)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, HISTORY_CHARS),
    }))

const asStringIds = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

const mergeColumns = (
  prev: ErdColumn[],
  incoming: unknown[],
  removeIds: Set<string>,
): ErdColumn[] => {
  const map = new Map(
    prev.filter((col) => !removeIds.has(col.id)).map((col) => [col.id, col]),
  )
  for (const raw of incoming) {
    if (!raw || typeof raw !== 'object') continue
    const col = raw as Partial<ErdColumn> & { id?: string }
    const id = typeof col.id === 'string' && col.id.trim() ? col.id.trim() : ''
    if (!id) continue
    const before = map.get(id)
    map.set(id, {
      ...(before || {
        length: undefined,
        pk: false,
        fk: false,
        nn: false,
        unique: false,
        autoIncrement: false,
      }),
      ...col,
      id,
      logicalName: col.logicalName || before?.logicalName || id,
      physicalName: col.physicalName || before?.physicalName || id,
      type: col.type || before?.type || 'varchar',
    } as ErdColumn)
  }
  return [...map.values()]
}

/** AI 패치를 현재 문서에 합쳐요. notes·domains·settings는 항상 남겨 둬요. */
export const applyAiPatch = (
  current: ErdDocument,
  patch: AiChatPatch,
): ErdDocument => {
  const removeTables = new Set(asStringIds(patch.removeTableIds))
  const tableMap = new Map(
    current.tables
      .filter((t) => !removeTables.has(t.id))
      .map((t) => [t.id, t] as const),
  )

  for (const raw of patch.upsertTables || []) {
    if (!raw || typeof raw !== 'object') continue
    const incoming = raw as Partial<ErdTable> & { id?: string }
    const id =
      typeof incoming.id === 'string' && incoming.id.trim()
        ? incoming.id.trim()
        : ''
    if (!id) continue
    const prev = tableMap.get(id)
    const columns =
      Array.isArray(incoming.columns) && incoming.columns.length
        ? (incoming.columns as ErdColumn[])
        : prev?.columns || []
    const position =
      incoming.position &&
      (incoming.position.x || incoming.position.y || incoming.position.x === 0)
        ? incoming.position
        : prev?.position || { x: 80, y: 80 }
    tableMap.set(id, {
      ...(prev || {}),
      ...incoming,
      id,
      logicalName: incoming.logicalName || prev?.logicalName || id,
      physicalName: incoming.physicalName || prev?.physicalName || id,
      color: incoming.color || prev?.color || '#3b82f6',
      position,
      columns,
      schemaId: incoming.schemaId ?? prev?.schemaId ?? '',
    } as ErdTable)
  }

  for (const raw of patch.upsertColumns || []) {
    if (!raw || typeof raw !== 'object') continue
    const tableId =
      typeof raw.tableId === 'string' && raw.tableId.trim()
        ? raw.tableId.trim()
        : ''
    if (!tableId) continue
    const prev = tableMap.get(tableId)
    if (!prev) continue
    const removeIds = new Set(asStringIds(raw.removeColumnIds))
    const incoming = Array.isArray(raw.columns) ? raw.columns : []
    tableMap.set(tableId, {
      ...prev,
      columns: mergeColumns(prev.columns, incoming, removeIds),
    })
  }

  const removeRels = new Set(asStringIds(patch.removeRelationIds))
  const relMap = new Map(
    current.relations
      .filter(
        (r) =>
          !removeRels.has(r.id) &&
          !removeTables.has(r.sourceTableId) &&
          !removeTables.has(r.targetTableId),
      )
      .map((r) => [r.id, r] as const),
  )

  for (const raw of patch.upsertRelations || []) {
    if (!raw || typeof raw !== 'object') continue
    const incoming = raw as Partial<ErdRelation> & { id?: string }
    const id =
      typeof incoming.id === 'string' && incoming.id.trim()
        ? incoming.id.trim()
        : ''
    if (!id || !incoming.sourceTableId || !incoming.targetTableId) continue
    const prev = relMap.get(id)
    relMap.set(id, {
      ...(prev || {}),
      ...incoming,
      id,
      sourceTableId: incoming.sourceTableId,
      targetTableId: incoming.targetTableId,
      sourceColumnIds: Array.isArray(incoming.sourceColumnIds)
        ? incoming.sourceColumnIds
        : prev?.sourceColumnIds || [],
      targetColumnIds: Array.isArray(incoming.targetColumnIds)
        ? incoming.targetColumnIds
        : prev?.targetColumnIds || [],
    } as ErdRelation)
  }

  return sanitizeAiDocument({
    ...current,
    tables: [...tableMap.values()],
    relations: [...relMap.values()],
    notes: current.notes,
    domains: current.domains,
    settings: current.settings,
  })
}

/** 채팅 모델 JSON을 온전한 문서로 풀어요. */
export const resolveChatDocument = (
  current: ErdDocument,
  parsed: unknown,
): { document: ErdDocument; mode: 'unchanged' | 'patch' | 'document' | 'document-merge' } => {
  const body =
    parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {}
  if (body.unchanged === true) {
    return {
      document: normalizeDocument(current),
      mode: 'unchanged',
    }
  }
  const patch = body.patch
  if (patch && typeof patch === 'object') {
    return {
      document: applyAiPatch(current, patch as AiChatPatch),
      mode: 'patch',
    }
  }
  const rawDoc = body.document ?? parsed
  const next = sanitizeAiDocument(rawDoc)
  const existingIds = new Set(current.tables.map((t) => t.id))
  const overlap = next.tables.filter((t) => existingIds.has(t.id)).length
  // 기존 id를 많이 가리키는 부분 "full"이면 통째로 지우지 말고 합쳐요.
  if (
    current.tables.length > 2 &&
    next.tables.length > 0 &&
    next.tables.length < current.tables.length &&
    overlap >= Math.ceil(next.tables.length * 0.5)
  ) {
    return {
      document: applyAiPatch(current, {
        upsertTables: next.tables,
        upsertRelations: next.relations,
      }),
      mode: 'document-merge',
    }
  }
  return {
    document: normalizeDocument({
      ...next,
      notes: current.notes,
      domains: current.domains,
      settings: current.settings,
      schemas: next.schemas?.length ? next.schemas : current.schemas,
    }),
    mode: 'document',
  }
}

export const buildChatUserPayload = (
  doc: ErdDocument,
  requestText: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
) => {
  const historyText = history.map((h) => h.content).join('\n')
  const context = buildChatContext(doc, requestText, historyText)
  return [
    `tableIndex:${JSON.stringify(context.tableIndex)}`,
    `detail${context.truncated ? '(truncated)' : ''}:${JSON.stringify({
      tables: context.tables,
      relations: context.relations,
    })}`,
    'Prefer upsertColumns for column edits; upsertTables only for new/rewritten tables.',
    `요청:${requestText}`,
  ].join('\n')
}
