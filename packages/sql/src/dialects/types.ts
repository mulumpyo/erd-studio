import type { DatabaseColumn, SqlDialect } from '@erd-studio/shared'

export type SqlColumn = Pick<
  DatabaseColumn,
  | 'physicalName'
  | 'type'
  | 'length'
  | 'nn'
  | 'unique'
  | 'autoIncrement'
  | 'defaultValue'
  | 'comment'
> & { pk: boolean }

export type SqlDialectStrategy = {
  id: SqlDialect
  ident: (name: string) => string
  currentTimestamp: string
  mapType: (col: SqlColumn) => string
  autoIncrementSuffix: (col: SqlColumn) => string
  columnComment: (text: string) => string
  closeCreateTable: (comment?: string) => string
  tableCommentSql: (tableName: string, comment: string) => string | null
}

export const escapeSql = (value: string) => value.replace(/'/g, "''")

export const defaultMapType = (col: SqlColumn) => {
  const t = col.type.toLowerCase()
  const len = col.length
  if (['varchar', 'char', 'decimal'].includes(t) && len)
    return `${t.toUpperCase()}(${len})`
  return t.toUpperCase()
}
