import { defaultMapType, type SqlColumn, type SqlDialectStrategy } from './types'

export const oracleDialect: SqlDialectStrategy = {
  id: 'oracle',
  ident: (name) => `"${name.toUpperCase()}"`,
  currentTimestamp: 'SYSTIMESTAMP',
  mapType: (col: SqlColumn) => {
    const t = col.type.toLowerCase()
    const len = col.length
    if (t === 'int' || t === 'bigint' || t === 'smallint') return 'NUMBER'
    if (t === 'varchar') return `VARCHAR2(${len || '255'})`
    if (t === 'text') return 'CLOB'
    if (t === 'boolean') return 'NUMBER(1)'
    if (t === 'datetime' || t === 'timestamp') return 'TIMESTAMP'
    if (t === 'json') return 'CLOB'
    if (t === 'uuid') return 'RAW(16)'
    return defaultMapType(col)
  },
  autoIncrementSuffix: () => '',
  columnComment: () => '',
  closeCreateTable: () => ');',
  tableCommentSql: () => null,
}
