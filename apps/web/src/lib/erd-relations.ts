import {
  createId,
  defaultColumn,
  orderTableColumns,
  type Cardinality,
  type ErdTable,
  type RelationKind,
} from '@erd-studio/shared'

export const planForeignKeyLink = (
  source: ErdTable,
  target: ErdTable,
  opts: {
    sourceColumnId?: string
    targetColumnId?: string
    kind: RelationKind
    sourceCardinality: Cardinality
    targetCardinality: Cardinality
  },
) => {
  const srcCols = opts.sourceColumnId
    ? source.columns.filter((c) => c.id === opts.sourceColumnId)
    : source.columns.filter((c) => c.pk)
  if (!srcCols.length) return null

  const nextTarget = { ...target, columns: [...target.columns] }
  const targetIds: string[] = []

  if (opts.targetColumnId) {
    targetIds.push(opts.targetColumnId)
    nextTarget.columns = nextTarget.columns.map((c) =>
      c.id === opts.targetColumnId ? { ...c, fk: true, nn: true } : c,
    )
  } else {
    for (const src of srcCols) {
      const physicalName = `${source.physicalName}_${src.physicalName}`
      const existing = nextTarget.columns.find(
        (c) => c.physicalName === physicalName,
      )
      if (existing) {
        targetIds.push(existing.id)
        continue
      }
      const fk = defaultColumn({
        logicalName: `${source.logicalName} ${src.logicalName}`,
        physicalName,
        type: src.type,
        length: src.length,
        fk: true,
        nn: true,
        pk: opts.kind === 'identifying',
      })
      nextTarget.columns.push(fk)
      targetIds.push(fk.id)
    }
  }

  nextTarget.columns = orderTableColumns(nextTarget.columns)

  return {
    nextTarget,
    relation: {
      id: createId('rel'),
      sourceTableId: source.id,
      targetTableId: target.id,
      sourceColumnIds: srcCols.map((c) => c.id),
      targetColumnIds: targetIds,
      kind: opts.kind,
      sourceCardinality: opts.sourceCardinality,
      targetCardinality: opts.targetCardinality,
    },
  }
}
