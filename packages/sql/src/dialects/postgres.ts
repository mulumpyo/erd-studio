import {
  defaultMapType,
  escapeSql,
  type SqlColumn,
  type SqlDialectStrategy,
} from './types'

export const postgresDialect: SqlDialectStrategy = {
  id: 'postgres',
  ident: (name) => `"${name}"`,
  currentTimestamp: 'CURRENT_TIMESTAMP',
  mapType: (col: SqlColumn) => {
    const t = col.type.toLowerCase()
    if (t === 'int' && col.autoIncrement && col.pk) return 'SERIAL'
    if (t === 'bigint' && col.autoIncrement && col.pk) return 'BIGSERIAL'
    if (t === 'datetime') return 'TIMESTAMP'
    if (t === 'double') return 'DOUBLE PRECISION'
    return defaultMapType(col)
  },
  autoIncrementSuffix: () => '',
  columnComment: () => '',
  closeCreateTable: () => ');',
  tableCommentSql: (tableName, comment) =>
    `COMMENT ON TABLE ${tableName} IS '${escapeSql(comment)}';`,
}
