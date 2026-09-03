import {
  dialectDefaultSchemaName,
  toDatabaseModel,
  type DatabaseModel,
  type DatabaseTable,
  type ErdDocument,
  type SqlDialect,
} from '@erd-studio/shared'
import { escapeSql, getDialect, type SqlColumn, type SqlDialectStrategy } from './dialects'

const isDefaultFn = (raw: string) =>
  /^(CURRENT_|GETDATE|SYSTIMESTAMP|NOW\()/i.test(raw)

const columnLine = (col: SqlColumn, dialect: SqlDialectStrategy) => {
  const parts = [`  ${dialect.ident(col.physicalName)} ${dialect.mapType(col)}`]
  if (col.nn) parts.push(' NOT NULL')
  if (col.unique && !col.pk) parts.push(' UNIQUE')
  const autoInc = dialect.autoIncrementSuffix(col)
  if (autoInc) parts.push(autoInc)
  if (col.defaultValue) {
    const raw = col.defaultValue.trim()
    parts.push(` DEFAULT ${isDefaultFn(raw) ? raw : `'${escapeSql(raw)}'`}`)
  }
  if (col.comment) {
    const comment = dialect.columnComment(col.comment)
    if (comment) parts.push(comment)
  }
  return parts.join('')
}

const shouldQualify = (
  model: DatabaseModel,
  schemaName: string,
  dialect: SqlDialect,
) => {
  if (!schemaName.trim()) return false
  const named = model.schemas.filter((schema) => schema.name.trim())
  if (named.length > 1) return true
  return (
    schemaName.toLowerCase() !== dialectDefaultSchemaName(dialect).toLowerCase()
  )
}

const tableSqlName = (
  model: DatabaseModel,
  table: DatabaseTable,
  dialect: SqlDialectStrategy,
) => {
  const schema = model.schemas.find((item) => item.id === table.schemaId)
  const schemaName = schema?.name ?? ''
  if (!shouldQualify(model, schemaName, dialect.id))
    return dialect.ident(table.physicalName)
  return `${dialect.ident(schemaName)}.${dialect.ident(table.physicalName)}`
}

export const generateSqlFromDatabase = (
  model: DatabaseModel,
  dialectId: SqlDialect = 'mysql',
) => {
  const dialect = getDialect(dialectId)
  const lines: string[] = [`-- ERD Studio ${dialect.id} export`, '']
  const columnsOf = (tableId: string) =>
    model.columns.filter((col) => col.tableId === tableId)
  const nameOf = (tableId: string, columnId: string) =>
    model.columns.find((col) => col.tableId === tableId && col.id === columnId)
      ?.physicalName

  for (const table of model.tables) {
    const columns = columnsOf(table.id)
    const pk = model.primaryKeys.find((item) => item.tableId === table.id)
    const pkIds = new Set(pk?.columnIds ?? [])
    const cols = columns.map((col) =>
      columnLine({ ...col, pk: pkIds.has(col.id) }, dialect),
    )
    const pkNames = (pk?.columnIds ?? [])
      .map((id) => nameOf(table.id, id))
      .filter(Boolean) as string[]
    if (pkNames.length)
      cols.push(`  PRIMARY KEY (${pkNames.map(dialect.ident).join(', ')})`)

    const tableName = tableSqlName(model, table, dialect)
    lines.push(`CREATE TABLE ${tableName} (`)
    lines.push(cols.join(',\n'))
    const tableComment = table.comment || table.logicalName
    lines.push(dialect.closeCreateTable(tableComment))
    const extra = tableComment
      ? dialect.tableCommentSql(tableName, tableComment)
      : null
    if (extra) lines.push(extra)
    lines.push('')
  }

  for (const rel of model.foreignKeys) {
    const source = model.tables.find((t) => t.id === rel.sourceTableId)
    const target = model.tables.find((t) => t.id === rel.targetTableId)
    if (!source || !target) continue
    const srcCols = rel.sourceColumnIds
      .map((id) => nameOf(source.id, id))
      .filter(Boolean) as string[]
    const tgtCols = rel.targetColumnIds
      .map((id) => nameOf(target.id, id))
      .filter(Boolean) as string[]
    if (!srcCols.length || !tgtCols.length) continue
    const name = rel.name || `fk_${target.physicalName}_${source.physicalName}`
    const actions: string[] = []
    if (rel.onDelete) actions.push(`ON DELETE ${rel.onDelete}`)
    if (rel.onUpdate) actions.push(`ON UPDATE ${rel.onUpdate}`)
    const suffix = actions.length ? ` ${actions.join(' ')}` : ''
    lines.push(
      `ALTER TABLE ${tableSqlName(model, target, dialect)} ADD CONSTRAINT ${dialect.ident(name)} FOREIGN KEY (${tgtCols.map(dialect.ident).join(', ')}) REFERENCES ${tableSqlName(model, source, dialect)} (${srcCols.map(dialect.ident).join(', ')})${suffix};`,
    )
  }

  return lines.join('\n').trim() + '\n'
}

export const generateSql = (
  doc: ErdDocument,
  dialect: SqlDialect = 'mysql',
) => generateSqlFromDatabase(toDatabaseModel(doc), dialect)
