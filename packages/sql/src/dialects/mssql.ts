import { defaultMapType, type SqlColumn, type SqlDialectStrategy } from './types'

export const mssqlDialect: SqlDialectStrategy = {
  id: 'mssql',
  ident: (name) => `[${name}]`,
  currentTimestamp: 'GETDATE()',
  mapType: (col: SqlColumn) => {
    const t = col.type.toLowerCase()
    const len = col.length
    if (t === 'int' && col.autoIncrement) return 'INT IDENTITY(1,1)'
    if (t === 'boolean') return 'BIT'
    if (t === 'timestamp' || t === 'datetime') return 'DATETIME2'
    if (t === 'text') return 'NVARCHAR(MAX)'
    if (t === 'varchar') return `NVARCHAR(${len || '255'})`
    if (t === 'json') return 'NVARCHAR(MAX)'
    if (t === 'uuid') return 'UNIQUEIDENTIFIER'
    return defaultMapType(col)
  },
  autoIncrementSuffix: () => '',
  columnComment: () => '',
  closeCreateTable: () => ');',
  tableCommentSql: () => null,
}
