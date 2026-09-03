import {
  defaultMapType,
  escapeSql,
  type SqlDialectStrategy,
} from './types'

export const mysqlDialect: SqlDialectStrategy = {
  id: 'mysql',
  ident: (name) => `\`${name}\``,
  currentTimestamp: 'CURRENT_TIMESTAMP',
  mapType: defaultMapType,
  autoIncrementSuffix: (col) => (col.autoIncrement ? ' AUTO_INCREMENT' : ''),
  columnComment: (text) => ` COMMENT '${escapeSql(text)}'`,
  closeCreateTable: (comment) =>
    `)${comment ? ` COMMENT='${escapeSql(comment)}'` : ''};`,
  tableCommentSql: () => null,
}
