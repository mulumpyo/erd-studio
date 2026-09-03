import type { ReferentialAction } from './referential'
import type {
  ErdColumn,
  ErdDocument,
  ErdDomain,
  ErdRelation,
  ErdTable,
} from './erd-types'
import { ensureStableId } from './ids'

export type DatabaseSchema = {
  id: string
  name: string
}

export type DatabaseTable = {
  id: string
  schemaId: string
  physicalName: string
  logicalName: string
  comment?: string
}

export type DatabaseColumn = {
  id: string
  tableId: string
  physicalName: string
  logicalName: string
  type: string
  length?: string
  nn: boolean
  unique: boolean
  autoIncrement: boolean
  defaultValue?: string
  comment?: string
  domainId?: string
}

export type DatabasePrimaryKey = {
  id: string
  tableId: string
  name: string
  columnIds: string[]
}

export type DatabaseForeignKey = {
  id: string
  name?: string
  sourceTableId: string
  targetTableId: string
  sourceColumnIds: string[]
  targetColumnIds: string[]
  onDelete?: ReferentialAction
  onUpdate?: ReferentialAction
}

export type DatabaseIndex = {
  id: string
  tableId: string
  name: string
  unique: boolean
  columnIds: string[]
}

export type DatabaseConstraint = {
  id: string
  tableId: string
  name: string
  kind: 'check' | 'unique' | 'exclude'
  expression?: string
  columnIds?: string[]
}

export type DatabaseDomain = ErdDomain

export type DatabaseModel = {
  schemas: DatabaseSchema[]
  tables: DatabaseTable[]
  columns: DatabaseColumn[]
  primaryKeys: DatabasePrimaryKey[]
  foreignKeys: DatabaseForeignKey[]
  indexes: DatabaseIndex[]
  constraints: DatabaseConstraint[]
  domains: DatabaseDomain[]
}

export const emptyDatabaseModel = (): DatabaseModel => ({
  schemas: [],
  tables: [],
  columns: [],
  primaryKeys: [],
  foreignKeys: [],
  indexes: [],
  constraints: [],
  domains: [],
})

export const primaryKeyIdFor = (tableId: string) =>
  ensureStableId('pk', `pk_${tableId}`, `pk:${tableId}`)

export const uniqueIndexIdFor = (columnId: string) =>
  ensureStableId('uq', `uq_${columnId}`, `uq:${columnId}`)

const toDatabaseColumn = (tableId: string, col: ErdColumn): DatabaseColumn => ({
  id: col.id,
  tableId,
  physicalName: col.physicalName,
  logicalName: col.logicalName,
  type: col.type,
  length: col.length,
  nn: col.nn,
  unique: col.unique,
  autoIncrement: col.autoIncrement,
  defaultValue: col.defaultValue,
  comment: col.comment,
  domainId: col.domainId,
})

const toDatabaseTable = (table: ErdTable): DatabaseTable => ({
  id: table.id,
  schemaId: table.schemaId,
  physicalName: table.physicalName,
  logicalName: table.logicalName,
  comment: table.comment,
})

const toPrimaryKey = (table: ErdTable): DatabasePrimaryKey | null => {
  const columnIds = table.columns.filter((col) => col.pk).map((col) => col.id)
  if (!columnIds.length) return null
  return {
    id: primaryKeyIdFor(table.id),
    tableId: table.id,
    name: `PK_${table.physicalName}`,
    columnIds,
  }
}

const toForeignKey = (rel: ErdRelation): DatabaseForeignKey => ({
  id: rel.id,
  name: rel.name,
  sourceTableId: rel.sourceTableId,
  targetTableId: rel.targetTableId,
  sourceColumnIds: [...rel.sourceColumnIds],
  targetColumnIds: [...rel.targetColumnIds],
  onDelete: rel.onDelete,
  onUpdate: rel.onUpdate,
})

const toUniqueIndexes = (table: ErdTable): DatabaseIndex[] =>
  table.columns
    .filter((col) => col.unique && !col.pk)
    .map((col) => ({
      id: uniqueIndexIdFor(col.id),
      tableId: table.id,
      name: `UQ_${table.physicalName}_${col.physicalName}`,
      unique: true,
      columnIds: [col.id],
    }))

export const toDatabaseModel = (doc: ErdDocument): DatabaseModel => {
  const primaryKeys = doc.tables
    .map(toPrimaryKey)
    .filter((item): item is DatabasePrimaryKey => !!item)
  return {
    schemas: doc.schemas.map((schema) => ({ ...schema })),
    tables: doc.tables.map(toDatabaseTable),
    columns: doc.tables.flatMap((table) =>
      table.columns.map((col) => toDatabaseColumn(table.id, col)),
    ),
    primaryKeys,
    foreignKeys: doc.relations.map(toForeignKey),
    indexes: doc.tables.flatMap(toUniqueIndexes),
    constraints: [],
    domains: doc.domains.map((domain) => ({ ...domain })),
  }
}
