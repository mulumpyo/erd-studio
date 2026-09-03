/* eslint-disable no-useless-escape */
import {
  createId,
  defaultColumn,
  dialectDefaultSchemaName,
  emptyDocument,
  ensureDocumentIds,
  makeSchema,
  normalizeReferentialAction,
  orderTableColumns,
  pkColumn,
  type ErdColumn,
  type ErdDocument,
  type ErdRelation,
  type ErdTable,
  type SqlDialect,
} from '@erd-studio/shared'

const stripQuotes = (name: string) => name.replace(/[`"[\]]/g, '')

const parseColumnDef = (raw: string): ErdColumn | null => {
  const line = raw.trim().replace(/,$/, '')
  if (
    !line ||
    /^(PRIMARY|UNIQUE|KEY|CONSTRAINT|FOREIGN|INDEX|CHECK)\b/i.test(line)
  )
    return null

  const match = line.match(
    /^([`"\[]?[\w가-힣]+[`"\]]?)\s+([A-Za-z0-9_]+)(?:\(([^)]+)\))?(.*)$/,
  )
  if (!match) return null
  const rest = match[4] ?? ''
  const type = match[2]
    .toLowerCase()
    .replace('nvarchar', 'varchar')
    .replace('varchar2', 'varchar')
  return defaultColumn({
    physicalName: stripQuotes(match[1]),
    logicalName: stripQuotes(match[1]),
    type: type === 'serial' || type === 'bigserial' ? 'int' : type,
    length: match[3],
    nn: /not\s+null/i.test(rest),
    unique: /\bunique\b/i.test(rest),
    autoIncrement: /auto_increment|identity|serial/i.test(line),
    pk: false,
    defaultValue: rest
      .match(/default\s+('[^']+'|[^\s,]+)/i)?.[1]
      ?.replace(/^'|'$/g, ''),
    comment: rest.match(/comment\s+'([^']+)'/i)?.[1],
  })
}

const parseQualifiedName = (raw: string) => {
  const parts = raw
    .split('.')
    .map((part) => stripQuotes(part.trim()))
    .filter(Boolean)
  if (parts.length >= 2) {
    return {
      schema: parts[parts.length - 2],
      name: parts[parts.length - 1],
    }
  }
  return { schema: undefined, name: parts[0] || raw }
}

const parseFkAction = (clause: string | undefined, kind: 'DELETE' | 'UPDATE') => {
  if (!clause) return undefined
  const match = clause.match(
    new RegExp(
      `ON\\s+${kind}\\s+(CASCADE|RESTRICT|SET\\s+NULL|SET\\s+DEFAULT|NO\\s+ACTION)`,
      'i',
    ),
  )
  return normalizeReferentialAction(match?.[1])
}

const findTable = (
  doc: ErdDocument,
  ident: { schema?: string; name: string },
) =>
  doc.tables.find((table) => {
    if (table.physicalName.toLowerCase() !== ident.name.toLowerCase())
      return false
    if (!ident.schema) return true
    const schema = doc.schemas.find((item) => item.id === table.schemaId)
    return (schema?.name ?? '').toLowerCase() === ident.schema.toLowerCase()
  })

const splitDefs = (body: string) => {
  const parts: string[] = []
  let current = ''
  let depth = 0
  for (const ch of body) {
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) parts.push(current)
  return parts
}

export const parseSql = (sql: string, dialect?: SqlDialect): ErdDocument => {
  const doc = emptyDocument()
  const schemaByKey = new Map<string, string>()
  const schemaFor = (name: string) => {
    const key = name.trim().toLowerCase()
    const existing = schemaByKey.get(key)
    if (existing) return existing
    const schema = makeSchema(name)
    schemaByKey.set(key, schema.id)
    doc.schemas.push(schema)
    return schema.id
  }
  const defaultSchemaName = dialectDefaultSchemaName(dialect)
  const createRe =
    /CREATE\s+TABLE\s+((?:[`"\[]?[\w가-힣]+[`"\]]?\.)*["`\[]?[\w가-힣]+["`\]]?)\s*\(([\s\S]*?)\)\s*(COMMENT\s*=\s*'([^']*)')?\s*;/gi
  let match: RegExpExecArray | null
  let x = 80
  let y = 80

  while ((match = createRe.exec(sql))) {
    const body = match[2]
    const columns: ErdColumn[] = []
    const pkNames = new Set<string>()
    const pkInline = body.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i)
    if (pkInline) {
      for (const name of pkInline[1].split(','))
        pkNames.add(stripQuotes(name.trim()).toLowerCase())
    }

    for (const part of splitDefs(body)) {
      const col = parseColumnDef(part)
      if (col) {
        if (
          pkNames.has(col.physicalName.toLowerCase()) ||
          /primary\s+key/i.test(part)
        ) {
          col.pk = true
          col.nn = true
        }
        columns.push(col)
      }
    }

    if (!columns.length) columns.push(pkColumn())

    const ident = parseQualifiedName(match[1])
    const table: ErdTable = {
      id: createId('tbl'),
      schemaId: schemaFor(ident.schema ?? defaultSchemaName),
      physicalName: ident.name,
      logicalName: match[4] || ident.name,
      color: '#3b82f6',
      position: { x, y },
      columns,
    }
    doc.tables.push(table)
    x += 320
    if (x > 1100) {
      x = 80
      y += 280
    }
  }

  const fkRe =
    /ALTER\s+TABLE\s+((?:[`"\[]?[\w가-힣]+[`"\]]?\.)*["`\[]?[\w가-힣]+["`\]]?)\s+ADD\s+CONSTRAINT\s+([`"\[]?[\w]+[`"\]]?)\s+FOREIGN\s+KEY\s*\(([^)]+)\)\s+REFERENCES\s+((?:[`"\[]?[\w가-힣]+[`"\]]?\.)*["`\[]?[\w가-힣]+["`\]]?)\s*\(([^)]+)\)((?:\s+ON\s+(?:DELETE|UPDATE)\s+(?:CASCADE|RESTRICT|SET\s+NULL|SET\s+DEFAULT|NO\s+ACTION))*)/gi
  while ((match = fkRe.exec(sql))) {
    const targetRef = parseQualifiedName(match[1])
    const sourceRef = parseQualifiedName(match[4])
    const target = findTable(doc, targetRef)
    const source = findTable(doc, sourceRef)
    if (!target || !source) continue
    const tgtCols = match[3].split(',').map((s) => stripQuotes(s.trim()))
    const srcCols = match[5].split(',').map((s) => stripQuotes(s.trim()))
    for (const name of tgtCols) {
      const col = target.columns.find(
        (c) => c.physicalName.toLowerCase() === name.toLowerCase(),
      )
      if (col) col.fk = true
    }
    const rel: ErdRelation = {
      id: createId('rel'),
      name: stripQuotes(match[2]),
      sourceTableId: source.id,
      targetTableId: target.id,
      sourceColumnIds: srcCols
        .map(
          (n) =>
            source.columns.find(
              (c) => c.physicalName.toLowerCase() === n.toLowerCase(),
            )?.id,
        )
        .filter(Boolean) as string[],
      targetColumnIds: tgtCols
        .map(
          (n) =>
            target.columns.find(
              (c) => c.physicalName.toLowerCase() === n.toLowerCase(),
            )?.id,
        )
        .filter(Boolean) as string[],
      kind: 'non-identifying',
      sourceCardinality: '1',
      targetCardinality: 'N',
      onDelete: parseFkAction(match[6], 'DELETE'),
      onUpdate: parseFkAction(match[6], 'UPDATE'),
    }
    doc.relations.push(rel)
  }

  for (const table of doc.tables) {
    table.columns = orderTableColumns(table.columns)
  }

  return ensureDocumentIds(doc, { dialect })
}
