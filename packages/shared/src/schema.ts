import type { ErdDocument, ErdSchema, ErdTable, SqlDialect } from './erd-types'
import { ensureStableId } from './ids'

export type SchemaContext = {
  dialect?: SqlDialect
}

export const dialectDefaultSchemaName = (dialect?: SqlDialect): string => {
  if (dialect === 'postgres') return 'public'
  if (dialect === 'mssql') return 'dbo'
  return ''
}

export const schemaIdForName = (name: string, existing?: string) =>
  ensureStableId('sch', existing, `schema:${name.trim().toLowerCase()}`)

export const makeSchema = (name: string, existing?: string): ErdSchema => ({
  id: schemaIdForName(name, existing),
  name,
})

const rememberSchema = (
  map: Map<string, string>,
  previous: string | undefined,
  next: string,
  name: string,
) => {
  const oldId = previous?.trim()
  if (oldId) map.set(oldId, next)
  map.set(next, next)
  if (name.trim()) map.set(name.trim().toLowerCase(), next)
}

const looksLikeSchemaName = (value: string) =>
  Boolean(value.trim()) && !value.startsWith('sch_')

export const ensureDocumentSchemas = (
  doc: ErdDocument,
  context: SchemaContext = {},
): ErdDocument => {
  const schemaIdMap = new Map<string, string>()
  const schemas: ErdSchema[] = (doc.schemas ?? []).map((schema) => {
    const name = schema.name?.trim() ?? ''
    const id = schemaIdForName(name, schema.id)
    rememberSchema(schemaIdMap, schema.id, id, name)
    return { id, name }
  })

  if (!schemas.length) {
    const named = [
      ...new Set(
        doc.tables
          .map((table) => table.schemaId?.trim())
          .filter((ref): ref is string => !!ref && looksLikeSchemaName(ref)),
      ),
    ]
    const stableIds = [
      ...new Set(
        doc.tables
          .map((table) => table.schemaId?.trim())
          .filter((ref): ref is string => !!ref && ref.startsWith('sch_')),
      ),
    ]
    const defaultName = dialectDefaultSchemaName(context.dialect)
    if (named.length) {
      for (const name of named) {
        const schema = makeSchema(name)
        rememberSchema(schemaIdMap, name, schema.id, schema.name)
        schemas.push(schema)
      }
    } else {
      const schema = makeSchema(
        defaultName,
        stableIds.length === 1 ? stableIds[0] : undefined,
      )
      rememberSchema(schemaIdMap, stableIds[0], schema.id, schema.name)
      schemas.push(schema)
    }
  }

  const fallback = schemas[0]
  if (!fallback) return { ...doc, schemas: [] }

  const tables: ErdTable[] = doc.tables.map((table) => {
    const ref = table.schemaId?.trim()
    const mapped = ref
      ? (schemaIdMap.get(ref) ??
        schemaIdMap.get(ref.toLowerCase()) ??
        (schemas.some((schema) => schema.id === ref) ? ref : undefined))
      : undefined
    return { ...table, schemaId: mapped || fallback.id }
  })

  return { ...doc, schemas, tables }
}
