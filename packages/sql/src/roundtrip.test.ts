import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toDatabaseModel, type ErdDocument, type SqlDialect } from '@erd-studio/shared'
import { generateSql, parseSql } from './index'

/**
 * 파서·내보내기가 일부러 안 다루는 SQL이에요.
 * 목록을 명시해 두어, 나중에 조용히 “지원하는 척” 하지 않게 해요.
 *
 * 방언: mysql | postgres | mssql | oracle (따로 적지 않으면 공통)
 * - CREATE/ALTER/DROP VIEW
 * - CREATE/DROP INDEX (단독; PK/UNIQUE는 컬럼으로 파싱될 수 있어요)
 * - CHECK 제약
 * - TRIGGER / PROCEDURE / FUNCTION 본문
 * - PARTITION BY / 테이블스페이스 / 스토리지 절
 * - CREATE TABLE 안쪽의 inline FOREIGN KEY (ALTER TABLE … ADD CONSTRAINT FK만 받아요)
 * - 복합 타입 / ENUM / DOMAIN DDL (단순 컬럼 타입 제외)
 * - COMMENT ON COLUMN (postgres 테이블 COMMENT ON TABLE은 내보내요; 컬럼 주석은 mysql 위주)
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
    // 방언이 식별자·타입을 바꿔도 (oracle) 구조 모양은 남아요.
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

test('composite PRIMARY KEY roundtrips column order for all dialects', () => {
  const sql = `
CREATE TABLE team_member (
  team_id varchar(36) NOT NULL,
  user_id varchar(36) NOT NULL,
  role varchar(32) NOT NULL,
  PRIMARY KEY (team_id, user_id)
);
`
  for (const dialect of DIALECTS) {
    const doc = parseSql(sql, dialect)
    const table = doc.tables[0]
    assert.ok(table, dialect)
    const pkCols = table.columns.filter((col) => col.pk).map((c) => c.physicalName)
    assert.deepEqual(
      pkCols.map((n) => n.toLowerCase()),
      ['team_id', 'user_id'],
      dialect,
    )
    const model = toDatabaseModel(doc)
    assert.deepEqual(
      model.primaryKeys[0].columnIds.map(
        (id) => table.columns.find((c) => c.id === id)!.physicalName.toLowerCase(),
      ),
      ['team_id', 'user_id'],
      dialect,
    )
    const out = generateSql(doc, dialect)
    const again = parseSql(out, dialect)
    const againPk = again.tables[0].columns
      .filter((col) => col.pk)
      .map((c) => c.physicalName.toLowerCase())
    assert.deepEqual(againPk, ['team_id', 'user_id'], `${dialect} re-parse`)
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
