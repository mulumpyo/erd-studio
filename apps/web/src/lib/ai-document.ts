import type { ErdDocument, ErdTable } from '@erd-studio/shared'

const slimColumn = (col: ErdTable['columns'][number]) => {
  const out: Record<string, unknown> = {
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

/** Slim ERD payload for /api/ai/chat (notes kept so server can preserve them). */
export const toAiRequestDocument = (doc: ErdDocument) => ({
  schemas: doc.schemas,
  tables: doc.tables.map((table) => ({
    id: table.id,
    ...(table.schemaId ? { schemaId: table.schemaId } : {}),
    logicalName: table.logicalName,
    physicalName: table.physicalName,
    color: table.color,
    position: table.position,
    columns: table.columns.map(slimColumn),
  })),
  relations: doc.relations.map((rel) => ({
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
  })),
  notes: doc.notes,
  domains: doc.domains,
  settings: doc.settings,
})
