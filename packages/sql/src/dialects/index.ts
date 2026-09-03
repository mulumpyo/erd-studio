import type { SqlDialect } from '@erd-studio/shared'
import { mysqlDialect } from './mysql'
import { postgresDialect } from './postgres'
import { mssqlDialect } from './mssql'
import { oracleDialect } from './oracle'
import type { SqlDialectStrategy } from './types'

export type { SqlColumn, SqlDialectStrategy } from './types'
export { escapeSql } from './types'

export const dialects: Record<SqlDialect, SqlDialectStrategy> = {
  mysql: mysqlDialect,
  postgres: postgresDialect,
  mssql: mssqlDialect,
  oracle: oracleDialect,
}

export const getDialect = (id: SqlDialect = 'mysql') => dialects[id]
