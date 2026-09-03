import type {
  ErdColumn,
  ErdDocument,
  ErdDomain,
  ErdNote,
  ErdRelation,
  ErdSchema,
  ErdTable,
} from './erd-types'
import { ensureDocumentIds } from './migrate-document'
import { normalizeReferentialAction } from './referential'
import { normalizeViewSettings } from './view-settings'

export const ERD_FILE_KIND = 'erd-studio'
export const ERD_FILE_VERSION = 1

export type ErdFile = {
  kind: typeof ERD_FILE_KIND
  version: number
  name?: string
  document: ErdDocument
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback

const asNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const asBool = (value: unknown) => Boolean(value)

const normalizeColumn = (raw: unknown): ErdColumn | null => {
  const col = asRecord(raw)
  if (!col) return null
  const physicalName =
    asString(col.physicalName) || asString(col.logicalName)
  if (!physicalName) return null
  return {
    id: asString(col.id),
    logicalName: asString(col.logicalName, physicalName),
    physicalName,
    type: asString(col.type, 'varchar'),
    length: asString(col.length) || undefined,
    pk: asBool(col.pk),
    fk: asBool(col.fk),
    nn: asBool(col.nn),
    unique: asBool(col.unique),
    autoIncrement: asBool(col.autoIncrement),
    defaultValue: asString(col.defaultValue) || undefined,
    comment: asString(col.comment) || undefined,
    domainId: asString(col.domainId) || undefined,
  }
}

const normalizeTable = (raw: unknown): ErdTable | null => {
  const table = asRecord(raw)
  if (!table) return null
  const physicalName =
    asString(table.physicalName) || asString(table.logicalName)
  if (!physicalName) return null
  const position = asRecord(table.position)
  const columns = Array.isArray(table.columns)
    ? table.columns.map(normalizeColumn).filter((col): col is ErdColumn => !!col)
    : []
  return {
    id: asString(table.id),
    schemaId: asString(table.schemaId),
    logicalName: asString(table.logicalName, physicalName),
    physicalName,
    comment: asString(table.comment) || undefined,
    color: asString(table.color, '#3b82f6'),
    position: {
      x: asNumber(position?.x),
      y: asNumber(position?.y),
    },
    columns,
  }
}

const normalizeRelation = (raw: unknown): ErdRelation | null => {
  const rel = asRecord(raw)
  if (!rel) return null
  const sourceTableId = asString(rel.sourceTableId)
  const targetTableId = asString(rel.targetTableId)
  if (!sourceTableId || !targetTableId) return null
  return {
    id: asString(rel.id),
    name: asString(rel.name) || undefined,
    sourceTableId,
    targetTableId,
    sourceColumnIds: Array.isArray(rel.sourceColumnIds)
      ? rel.sourceColumnIds.filter((item): item is string => typeof item === 'string')
      : [],
    targetColumnIds: Array.isArray(rel.targetColumnIds)
      ? rel.targetColumnIds.filter((item): item is string => typeof item === 'string')
      : [],
    kind: rel.kind === 'identifying' ? 'identifying' : 'non-identifying',
    sourceCardinality: rel.sourceCardinality === 'N' ? 'N' : '1',
    targetCardinality: rel.targetCardinality === '1' ? '1' : 'N',
    onDelete: normalizeReferentialAction(rel.onDelete),
    onUpdate: normalizeReferentialAction(rel.onUpdate),
  }
}

const normalizeNote = (raw: unknown): ErdNote | null => {
  const note = asRecord(raw)
  if (!note) return null
  const position = asRecord(note.position)
  return {
    id: asString(note.id),
    text: asString(note.text),
    color: asString(note.color, '#fef3c7'),
    position: {
      x: asNumber(position?.x),
      y: asNumber(position?.y),
    },
    width: asNumber(note.width, 200),
    height: asNumber(note.height, 120),
  }
}

const normalizeDomain = (raw: unknown): ErdDomain | null => {
  const domain = asRecord(raw)
  if (!domain) return null
  const name = asString(domain.name)
  if (!name) return null
  return {
    id: asString(domain.id),
    name,
    type: asString(domain.type, 'varchar'),
    length: asString(domain.length) || undefined,
    nn: asBool(domain.nn),
  }
}

const normalizeSchema = (raw: unknown): ErdSchema | null => {
  const schema = asRecord(raw)
  if (!schema) return null
  return {
    id: asString(schema.id),
    name: asString(schema.name),
  }
}

export const normalizeDocument = (raw: unknown): ErdDocument => {
  const doc = asRecord(raw)
  if (!doc) {
    return ensureDocumentIds({
      schemas: [],
      tables: [],
      relations: [],
      notes: [],
      domains: [],
      settings: normalizeViewSettings(),
    })
  }
  return ensureDocumentIds({
    schemas: Array.isArray(doc.schemas)
      ? doc.schemas
          .map(normalizeSchema)
          .filter((item): item is ErdSchema => !!item)
      : [],
    tables: Array.isArray(doc.tables)
      ? doc.tables.map(normalizeTable).filter((item): item is ErdTable => !!item)
      : [],
    relations: Array.isArray(doc.relations)
      ? doc.relations
          .map(normalizeRelation)
          .filter((item): item is ErdRelation => !!item)
      : [],
    notes: Array.isArray(doc.notes)
      ? doc.notes.map(normalizeNote).filter((item): item is ErdNote => !!item)
      : [],
    domains: Array.isArray(doc.domains)
      ? doc.domains
          .map(normalizeDomain)
          .filter((item): item is ErdDomain => !!item)
      : [],
    settings: normalizeViewSettings(doc.settings as ErdDocument['settings']),
  })
}

export const toErdFile = (document: ErdDocument, name?: string): ErdFile => ({
  kind: ERD_FILE_KIND,
  version: ERD_FILE_VERSION,
  ...(name ? { name } : {}),
  document: normalizeDocument(document),
})

export const stringifyErdFile = (document: ErdDocument, name?: string) =>
  `${JSON.stringify(toErdFile(document, name), null, 2)}\n`

export const parseErdFile = (raw: string): ErdDocument => {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('JSON 형식이 아니에요')
  }
  const file = asRecord(data)
  if (!file) throw new Error('ERD 파일이 아니에요')
  if (file.kind === ERD_FILE_KIND || file.document) {
    return normalizeDocument(file.document)
  }
  if (Array.isArray(file.tables)) return normalizeDocument(file)
  throw new Error('ERD 파일이 아니에요')
}
