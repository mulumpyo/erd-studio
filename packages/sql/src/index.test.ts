import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toCanvasModel, toDatabaseModel } from '@erd-studio/shared'
import {
  generateSql,
  generateSqlFromDatabase,
  parseSql,
} from './index'

const SAMPLE = `
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

test('sql import assigns stable ids and export ignores canvas position', () => {
  const doc = parseSql(SAMPLE)
  assert.ok(doc.tables[0].id)
  assert.ok(doc.tables[0].columns[0].id)
  const sqlBefore = generateSql(doc, 'mysql')
  const dbBefore = toDatabaseModel(doc)
  doc.tables[0].position = { x: 999, y: 999 }
  doc.tables[1].position = { x: 10, y: 10 }
  assert.deepEqual(toDatabaseModel(doc), dbBefore)
  assert.equal(generateSql(doc, 'mysql'), sqlBefore)
  assert.equal(generateSqlFromDatabase(dbBefore, 'mysql'), sqlBefore)
  assert.equal(toCanvasModel(doc).tables[0].position.x, 999)
})

test('sql import/export keeps table and fk names for mysql', () => {
  const doc = parseSql(SAMPLE)
  const sql = generateSql(doc, 'mysql')
  assert.match(sql, /CREATE TABLE `users`/)
  assert.match(sql, /CREATE TABLE `posts`/)
  assert.match(sql, /FOREIGN KEY \(`user_id`\) REFERENCES `users` \(`id`\)/)
  assert.equal(doc.schemas.length, 1)
  assert.equal(doc.schemas[0].name, '')
  assert.equal(doc.tables[0].schemaId, doc.schemas[0].id)
})

test('sql export for all dialects is independent of canvas position', () => {
  const doc = parseSql(SAMPLE)
  const before = {
    mysql: generateSql(doc, 'mysql'),
    postgres: generateSql(doc, 'postgres'),
    mssql: generateSql(doc, 'mssql'),
    oracle: generateSql(doc, 'oracle'),
  }
  doc.tables[0].position = { x: 1, y: 2 }
  doc.tables[1].color = '#111111'
  for (const dialect of ['mysql', 'postgres', 'mssql', 'oracle'] as const) {
    assert.equal(generateSql(doc, dialect), before[dialect])
    assert.equal(
      generateSqlFromDatabase(toDatabaseModel(doc), dialect),
      before[dialect],
    )
  }
})

test('postgres default schema is public and stays unqualified on export', () => {
  const doc = parseSql(SAMPLE, 'postgres')
  assert.equal(doc.schemas[0].name, 'public')
  const sql = generateSql(doc, 'postgres')
  assert.match(sql, /CREATE TABLE "users"/)
  assert.doesNotMatch(sql, /CREATE TABLE "public"\."users"/)
})

test('qualified names become schema objects and export qualifies non-default schemas', () => {
  const sql = `
CREATE TABLE billing.payments (
  id int NOT NULL,
  PRIMARY KEY (id)
);
CREATE TABLE public.users (
  id int NOT NULL,
  PRIMARY KEY (id)
);
`
  const doc = parseSql(sql, 'postgres')
  const names = doc.schemas.map((schema) => schema.name).sort()
  assert.deepEqual(names, ['billing', 'public'])
  const payments = doc.tables.find((table) => table.physicalName === 'payments')
  const users = doc.tables.find((table) => table.physicalName === 'users')
  assert.ok(payments && users)
  assert.equal(
    doc.schemas.find((schema) => schema.id === payments.schemaId)?.name,
    'billing',
  )
  const exported = generateSql(doc, 'postgres')
  assert.match(exported, /CREATE TABLE "billing"\."payments"/)
  assert.match(exported, /CREATE TABLE "public"\."users"/)
})

