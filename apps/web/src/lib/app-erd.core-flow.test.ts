import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseErdFile, toDatabaseModel } from '@erd-studio/shared'
import { generateSql, parseSql } from '@erd-studio/sql'
import { AI_FEATURES_ENABLED } from './feature-flags'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../')
const fixturePath = resolve(root, 'apps/web/src/fixtures/erd-studio-app.erd.json')
const prismaPath = resolve(root, 'apps/api/prisma/schema.prisma')

const COMPOSITE_PK_TABLES: Record<string, string[]> = {
  TeamMember: ['teamId', 'userId'],
  ProjectMember: ['projectId', 'userId'],
  UserActivityDay: ['day', 'userId'],
}

describe('feature flags', () => {
  it('AI stays off unless VITE_AI_FEATURES_ENABLED=true at build time', () => {
    // Vitest/Vite 기본은 플래그 미설정 → false
    expect(AI_FEATURES_ENABLED).toBe(false)
  })
})

describe('app ERD core flow', () => {
  it('fixture matches Prisma composite @@id column order', () => {
    const prisma = readFileSync(prismaPath, 'utf8')
    for (const [table, cols] of Object.entries(COMPOSITE_PK_TABLES)) {
      const block = prisma.match(
        new RegExp(`model ${table} \\{[\\s\\S]*?@@id\\(\\[([^\\]]+)\\]\\)`),
      )
      expect(block, table).toBeTruthy()
      const idCols = block![1]!.split(',').map((s) => s.trim())
      expect(idCols).toEqual(cols)
    }
  })

  it('loads tracked fixture with composite PKs', () => {
    const doc = parseErdFile(readFileSync(fixturePath, 'utf8'))
    expect(doc.tables.length).toBeGreaterThanOrEqual(12)
    const model = toDatabaseModel(doc)
    for (const [tableName, pkNames] of Object.entries(COMPOSITE_PK_TABLES)) {
      const table = doc.tables.find((t) => t.physicalName === tableName)
      expect(table, tableName).toBeTruthy()
      const pk = model.primaryKeys.find((item) => item.tableId === table!.id)
      expect(
        pk?.columnIds.map(
          (id) => table!.columns.find((c) => c.id === id)!.physicalName,
        ),
      ).toEqual(pkNames)
    }
  })

  it('postgres SQL roundtrip keeps composite PK order', () => {
    const doc = parseErdFile(readFileSync(fixturePath, 'utf8'))
    const again = parseSql(generateSql(doc, 'postgres'), 'postgres')
    for (const [tableName, pkNames] of Object.entries(COMPOSITE_PK_TABLES)) {
      const table = again.tables.find(
        (t) => t.physicalName.toLowerCase() === tableName.toLowerCase(),
      )
      expect(table, tableName).toBeTruthy()
      expect(
        table!.columns.filter((c) => c.pk).map((c) => c.physicalName.toLowerCase()),
      ).toEqual(pkNames.map((n) => n.toLowerCase()))
    }
  })
})
