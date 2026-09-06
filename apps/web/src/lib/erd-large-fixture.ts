import {
  createId,
  emptyDocument,
  defaultTable,
  pkColumn,
  type ErdDocument,
  type ErdRelation,
  type ErdTable,
} from '@erd-studio/shared'

export type LargeErdFixtureOptions = {
  tables?: number
  edges?: number
  colsPerTable?: number
  seed?: number
}

const mulberry32 = (seed: number) => {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Deterministic large ERD for perf / Vitest fixtures (default 200 tables, 400 edges).
 */
export const generateLargeErd = (
  options: LargeErdFixtureOptions = {},
): ErdDocument => {
  const tableCount = options.tables ?? 200
  const edgeCount = options.edges ?? 400
  const colsPerTable = Math.max(1, options.colsPerTable ?? 4)
  const rand = mulberry32(options.seed ?? 42)
  const doc = emptyDocument()
  const schemaId = createId('sch')

  const tables: ErdTable[] = []
  for (let i = 0; i < tableCount; i += 1) {
    const cols = [pkColumn()]
    for (let c = 1; c < colsPerTable; c += 1) {
      cols.push({
        id: createId('col'),
        logicalName: `컬럼 ${c}`,
        physicalName: `col_${c}`,
        type: 'varchar',
        length: '255',
        pk: false,
        fk: false,
        nn: false,
        unique: false,
        autoIncrement: false,
      })
    }
    const col = Math.floor(i % 20)
    const row = Math.floor(i / 20)
    tables.push(
      defaultTable({
        id: createId('tbl'),
        schemaId,
        logicalName: `테이블 ${i + 1}`,
        physicalName: `table_${i + 1}`,
        position: { x: 80 + col * 380, y: 80 + row * 280 },
        columns: cols,
      }),
    )
  }

  const relations: ErdRelation[] = []
  const seen = new Set<string>()
  let guard = 0
  while (relations.length < edgeCount && guard < edgeCount * 8) {
    guard += 1
    const si = Math.floor(rand() * tableCount)
    const ti = Math.floor(rand() * tableCount)
    const source = tables[si]
    const target = tables[ti]
    if (!source || !target) continue
    const sourceCol = source.columns[0]
    if (!sourceCol) continue
    const key = `${source.id}->${target.id}:${sourceCol.id}`
    if (seen.has(key)) continue
    seen.add(key)

    let targetColId = target.columns.find((c) => c.fk)?.id
    if (!targetColId || source.id === target.id) {
      const fkId = createId('col')
      target.columns = [
        ...target.columns,
        {
          id: fkId,
          logicalName: `${source.logicalName} FK`,
          physicalName: `${source.physicalName}_id`,
          type: 'bigint',
          pk: false,
          fk: true,
          nn: true,
          unique: false,
          autoIncrement: false,
        },
      ]
      targetColId = fkId
    }

    relations.push({
      id: createId('rel'),
      sourceTableId: source.id,
      targetTableId: target.id,
      sourceColumnIds: [sourceCol.id],
      targetColumnIds: [targetColId],
      kind: 'non-identifying',
      sourceCardinality: '1',
      targetCardinality: 'N',
    })
  }

  return {
    ...doc,
    schemas: [{ id: schemaId, name: 'public' }],
    tables,
    relations,
    notes: [],
    domains: [],
  }
}
