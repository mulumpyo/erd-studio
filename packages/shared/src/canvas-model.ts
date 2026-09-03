import { defaultViewSettings, type ErdViewSettings } from './view-settings'
import type {
  Cardinality,
  ErdDocument,
  ErdNote,
  ErdRelation,
  ErdTable,
  RelationKind,
} from './erd-types'
import type { DatabaseModel } from './database-model'

const DEFAULT_TABLE_COLOR = '#3b82f6'

export type CanvasTableLayout = {
  tableId: string
  position: { x: number; y: number }
  color: string
  width?: number
  height?: number
}

export type CanvasRelationLayout = {
  relationId: string
  kind: RelationKind
  sourceCardinality: Cardinality
  targetCardinality: Cardinality
  routing?: unknown
}

export type CanvasViewport = {
  x: number
  y: number
  zoom: number
}

export type CanvasModel = {
  tables: CanvasTableLayout[]
  notes: ErdNote[]
  relations: CanvasRelationLayout[]
  settings: ErdViewSettings
  viewport?: CanvasViewport
}

export const emptyCanvasModel = (): CanvasModel => ({
  tables: [],
  notes: [],
  relations: [],
  settings: defaultViewSettings(),
})

export const toCanvasModel = (doc: ErdDocument): CanvasModel => ({
  tables: doc.tables.map((table) => ({
    tableId: table.id,
    position: { ...table.position },
    color: table.color,
  })),
  notes: doc.notes.map((note) => ({
    ...note,
    position: { ...note.position },
  })),
  relations: doc.relations.map((rel) => ({
    relationId: rel.id,
    kind: rel.kind,
    sourceCardinality: rel.sourceCardinality,
    targetCardinality: rel.targetCardinality,
  })),
  settings: {
    nameMode: doc.settings.nameMode,
    show: { ...doc.settings.show },
  },
})

const pkIds = (model: DatabaseModel, tableId: string) =>
  new Set(
    model.primaryKeys.find((item) => item.tableId === tableId)?.columnIds ?? [],
  )

const fkIds = (model: DatabaseModel, tableId: string) => {
  const ids = new Set<string>()
  for (const fk of model.foreignKeys) {
    if (fk.targetTableId !== tableId) continue
    for (const id of fk.targetColumnIds) ids.add(id)
  }
  return ids
}

export const fromModels = (
  database: DatabaseModel,
  canvas: CanvasModel = emptyCanvasModel(),
): ErdDocument => {
  const layoutByTable = new Map(
    canvas.tables.map((layout) => [layout.tableId, layout]),
  )
  const relationLayout = new Map(
    canvas.relations.map((layout) => [layout.relationId, layout]),
  )
  const columnsByTable = new Map<string, DatabaseModel['columns']>()
  for (const col of database.columns) {
    const list = columnsByTable.get(col.tableId) ?? []
    list.push(col)
    columnsByTable.set(col.tableId, list)
  }

  const tables: ErdTable[] = database.tables.map((table, index) => {
    const layout = layoutByTable.get(table.id)
    const pks = pkIds(database, table.id)
    const fks = fkIds(database, table.id)
    return {
      id: table.id,
      schemaId: table.schemaId,
      physicalName: table.physicalName,
      logicalName: table.logicalName,
      comment: table.comment,
      color: layout?.color ?? DEFAULT_TABLE_COLOR,
      position: layout?.position ?? { x: 80 + (index % 4) * 320, y: 80 + Math.floor(index / 4) * 280 },
      columns: (columnsByTable.get(table.id) ?? []).map((col) => ({
        id: col.id,
        physicalName: col.physicalName,
        logicalName: col.logicalName,
        type: col.type,
        length: col.length,
        pk: pks.has(col.id),
        fk: fks.has(col.id),
        nn: col.nn,
        unique: col.unique,
        autoIncrement: col.autoIncrement,
        defaultValue: col.defaultValue,
        comment: col.comment,
        domainId: col.domainId,
      })),
    }
  })

  const relations: ErdRelation[] = database.foreignKeys.map((fk) => {
    const layout = relationLayout.get(fk.id)
    return {
      id: fk.id,
      name: fk.name,
      sourceTableId: fk.sourceTableId,
      targetTableId: fk.targetTableId,
      sourceColumnIds: [...fk.sourceColumnIds],
      targetColumnIds: [...fk.targetColumnIds],
      kind: layout?.kind ?? 'non-identifying',
      sourceCardinality: layout?.sourceCardinality ?? '1',
      targetCardinality: layout?.targetCardinality ?? 'N',
      onDelete: fk.onDelete,
      onUpdate: fk.onUpdate,
    }
  })

  return {
    schemas: database.schemas.map((schema) => ({ ...schema })),
    tables,
    relations,
    notes: canvas.notes.map((note) => ({
      ...note,
      position: { ...note.position },
    })),
    domains: database.domains.map((domain) => ({ ...domain })),
    settings: canvas.settings,
  }
}

export const documentFromDatabase = (
  database: DatabaseModel,
  canvas?: CanvasModel,
): ErdDocument => fromModels(database, canvas ?? emptyCanvasModel())
