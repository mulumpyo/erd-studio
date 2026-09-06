import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toDatabaseModel, type ErdDocument, type SqlDialect } from '@erd-studio/shared'
import { generateSql, parseSql } from './index'

/**
 * Unsupported SQL surface (parser/exporter intentionally omit these).
 * Keep this list explicit so regressions cannot silently “accept” them.
 *
 * Dialects: mysql | postgres | mssql | oracle (all share this matrix unless noted)
 * - CREATE/ALTER/DROP VIEW
 * - CREATE/DROP INDEX (standalone; PK/UNIQUE inline may still parse as columns)
 * - CHECK constraints
 * - TRIGGER / PROCEDURE / FUNCTION bodies
 * - PARTITION BY / tablespaces / storage clauses
 * - Inline FOREIGN KEY / CONSTRAINT inside CREATE TABLE (only ALTER TABLE … ADD CONSTRAINT FK)
 * - Composite type / ENUM / DOMAIN DDL beyond plain column types
 * - Comments via COMMENT ON COLUMN (postgres table COMMENT ON TABLE is exported; column comments only on mysql import/export)
 */
export const UNSUPPORTED_SQL_FEATURES = [
  'CREATE VIEW',
  'CREATE INDEX',
  'CHECK constraint',
  'TRIGGER',
  'PARTITION BY',
  'inline FOREIGN KEY in CREATE TABLE',
] as const

const DIALECTS: SqlDialect[] = ['mysql', 'postgres', 'mssql', 'oracle']

const SAMPLE_MYSQL = `
CREATE TABLE \`users\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`email\` varchar(255) NOT NULL UNIQUE,
  PRIMARY KEY (\`id\`)
) COMMENT='사용자';

CREATE TABLE \`posts\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`user_id\` int NOT NULL,
  \`title\` varchar(200) NOT NULL,
  PRIMARY KEY (\`id\`)
);

ALTER TABLE \`posts\` ADD CONSTRAINT \`fk_posts_users\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE;
`

const fingerprint = (doc: ErdDocument) => {
  const tables = doc.tables
    .map((table) => ({
      physicalName: table.physicalName,
      columns: table.columns.map((col) => ({
        physicalName: col.physicalName,
        type: col.type.toLowerCase(),
        pk: Boolean(col.pk),
        nn: Boolean(col.nn),
        unique: Boolean(col.unique),
        fk: Boolean(col.fk),
        length: col.length ?? null,
      })),
    }))
    .sort((a, b) => a.physicalName.localeCompare(b.physicalName))
  const relations = doc.relations
    .map((rel) => {
      const source = doc.tables.find((t) => t.id === rel.sourceTableId)
      const target = doc.tables.find((t) => t.id === rel.targetTableId)
      const colName = (tableId: string, columnId: string) =>
        doc.tables
          .find((t) => t.id === tableId)
          ?.columns.find((c) => c.id === columnId)?.physicalName
      return {
        name: rel.name ?? null,
        source: source?.physicalName,
        target: target?.physicalName,
        sourceColumns: rel.sourceColumnIds.map((id) =>
          colName(rel.sourceTableId, id),
        ),
        targetColumns: rel.targetColumnIds.map((id) =>
          colName(rel.targetTableId, id),
        ),
        onDelete: rel.onDelete ?? null,
      }
    })
    .sort((a, b) =>
      `${a.source}:${a.target}:${a.name}`.localeCompare(
        `${b.source}:${b.target}:${b.name}`,
      ),
    )
  return { tables, relations }
}

test('parse → generate → parse golden roundtrip for all dialects', () => {
  for (const dialect of DIALECTS) {
    const first = parseSql(SAMPLE_MYSQL, dialect)
    const sql1 = generateSql(first, dialect)
    const second = parseSql(sql1, dialect)
    const sql2 = generateSql(second, dialect)
    assert.equal(
      sql2,
      sql1,
      `generated SQL is not stable after re-parse for ${dialect}`,
    )
    assert.equal(second.tables.length, first.tables.length)
    assert.equal(second.relations.length, first.relations.length)
    assert.equal(toDatabaseModel(second).foreignKeys.length, 1)
    // Structural shape survives even when a dialect rewrites idents/types (oracle).
    assert.deepEqual(
      fingerprint(second).tables.map((t) => ({
        name: t.physicalName.toLowerCase(),
        columns: t.columns.map((c) => c.physicalName.toLowerCase()).sort(),
      })),
      fingerprint(first).tables.map((t) => ({
        name: t.physicalName.toLowerCase(),
        columns: t.columns.map((c) => c.physicalName.toLowerCase()).sort(),
      })),
    )
  }
})

test('unsupported SQL features are listed and do not silently invent ERD objects', () => {
  assert.equal(UNSUPPORTED_SQL_FEATURES.length, 6)

  const viewOnly = parseSql('CREATE VIEW active_users AS SELECT 1;', 'mysql')
  assert.equal(viewOnly.tables.length, 0)
  assert.equal(viewOnly.relations.length, 0)

  const indexOnly = parseSql(
    'CREATE INDEX idx_users_email ON users (email);',
    'postgres',
  )
  assert.equal(indexOnly.tables.length, 0)

  const withCheck = parseSql(
    `
CREATE TABLE scores (
  id int NOT NULL,
  value int NOT NULL,
  CHECK (value >= 0),
  PRIMARY KEY (id)
);
`,
    'postgres',
  )
  assert.equal(withCheck.tables.length, 1)
  assert.equal(withCheck.tables[0].columns.length, 2)
  assert.equal(
    withCheck.tables[0].columns.some((col) => /check/i.test(col.physicalName)),
    false,
  )

  const triggerSql = parseSql(
    `
CREATE TABLE t (id int PRIMARY KEY);
CREATE TRIGGER trg BEFORE INSERT ON t FOR EACH ROW BEGIN END;
`,
    'mysql',
  )
  assert.equal(triggerSql.tables.length, 1)
  assert.equal(triggerSql.relations.length, 0)

  const partitioned = parseSql(
    `
CREATE TABLE events (
  id int NOT NULL,
  PRIMARY KEY (id)
) PARTITION BY RANGE (id);
`,
    'mysql',
  )
  assert.equal(partitioned.tables.length, 1)

  const inlineFk = parseSql(
    `
CREATE TABLE parent (id int PRIMARY KEY);
CREATE TABLE child (
  id int PRIMARY KEY,
  parent_id int,
  FOREIGN KEY (parent_id) REFERENCES parent(id)
);
`,
    'mysql',
  )
  assert.equal(inlineFk.tables.length, 2)
  assert.equal(
    inlineFk.relations.length,
    0,
    'inline FK must not be silently treated as a relation',
  )
})
