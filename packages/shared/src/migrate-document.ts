import type { ErdColumn, ErdDocument, ErdRelation, ErdTable } from './erd-types'
import { ensureStableId } from './ids'
import { ensureDocumentSchemas, type SchemaContext } from './schema'

const tableSeed = (table: ErdTable, index: number) =>
  `table:${index}:${table.physicalName}:${table.logicalName}`

const remember = (map: Map<string, string>, previous: string | undefined, next: string) => {
  const oldId = previous?.trim()
  if (oldId) map.set(oldId, next)
  map.set(next, next)
}

const remapByName = <T extends { id: string }>(
  items: T[],
  ref: string,
  nameOf: (item: T) => string,
) => {
  const match = items.filter(
    (item) => nameOf(item).toLowerCase() === ref.trim().toLowerCase(),
  )
  return match.length === 1 ? match[0].id : ref
}

const remapTableRef = (
  tables: ErdTable[],
  tableIdMap: Map<string, string>,
  ref: string,
) => {
  const mapped = tableIdMap.get(ref) ?? tableIdMap.get(ref.trim())
  if (mapped) return mapped
  if (tables.some((table) => table.id === ref)) return ref
  return remapByName(tables, ref, (table) => table.physicalName)
}

const remapColumnRef = (
  columns: ErdColumn[],
  columnIdMap: Map<string, string>,
  ref: string,
) => {
  const mapped = columnIdMap.get(ref) ?? columnIdMap.get(ref.trim())
  if (mapped) return mapped
  if (columns.some((col) => col.id === ref)) return ref
  return remapByName(columns, ref, (col) => col.physicalName)
}

export const ensureDocumentIds = (
  doc: ErdDocument,
  context: SchemaContext = {},
): ErdDocument => {
  const tableIdMap = new Map<string, string>()
  const columnIdMap = new Map<string, string>()
  const domainIdMap = new Map<string, string>()

  const domains = doc.domains.map((domain, index) => {
    const id = ensureStableId('dom', domain.id, `dom:${index}:${domain.name}`)
    remember(domainIdMap, domain.id, id)
    return { ...domain, id }
  })

  const remapDomainId = (ref?: string) => {
    if (!ref) return undefined
    const mapped = domainIdMap.get(ref) ?? domainIdMap.get(ref.trim())
    if (mapped) return mapped
    if (domains.some((domain) => domain.id === ref)) return ref
    return remapByName(domains, ref, (domain) => domain.name)
  }

  const tables = doc.tables.map((table, index) => {
    const id = ensureStableId('tbl', table.id, tableSeed(table, index))
    remember(tableIdMap, table.id, id)
    const columns = table.columns.map((col, colIndex) => {
      const colId = ensureStableId(
        'col',
        col.id,
        `${id}:${colIndex}:${col.physicalName}:${col.logicalName}`,
      )
      remember(columnIdMap, col.id, colId)
      return { ...col, id: colId, domainId: remapDomainId(col.domainId) }
    })
    return { ...table, id, columns }
  })

  const relations: ErdRelation[] = doc.relations.map((rel, index) => {
    const sourceTableId = remapTableRef(tables, tableIdMap, rel.sourceTableId)
    const targetTableId = remapTableRef(tables, tableIdMap, rel.targetTableId)
    const sourceColumns =
      tables.find((table) => table.id === sourceTableId)?.columns ?? []
    const targetColumns =
      tables.find((table) => table.id === targetTableId)?.columns ?? []
    const sourceColumnIds = rel.sourceColumnIds.map((id) =>
      remapColumnRef(sourceColumns, columnIdMap, id),
    )
    const targetColumnIds = rel.targetColumnIds.map((id) =>
      remapColumnRef(targetColumns, columnIdMap, id),
    )
    return {
      ...rel,
      id: ensureStableId(
        'rel',
        rel.id,
        `rel:${index}:${sourceTableId}:${targetTableId}:${sourceColumnIds.join(',')}:${targetColumnIds.join(',')}`,
      ),
      sourceTableId,
      targetTableId,
      sourceColumnIds,
      targetColumnIds,
    }
  })

  const notes = doc.notes.map((note, index) => ({
    ...note,
    id: ensureStableId('note', note.id, `note:${index}:${note.text}`),
  }))

  return ensureDocumentSchemas(
    { ...doc, tables, relations, notes, domains },
    context,
  )
}
