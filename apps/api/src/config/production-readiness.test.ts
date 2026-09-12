import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')

const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8')

test('production readiness: compose healthchecks cover api/web/collab', () => {
  const compose = read('docker-compose.prod.yml')
  assert.match(compose, /api:[\s\S]*?healthcheck:[\s\S]*?\/api\/health/)
  assert.match(compose, /web:[\s\S]*?healthcheck:[\s\S]*?wget/)
  assert.match(compose, /collab:[\s\S]*?healthcheck:[\s\S]*?\/health/)
  assert.match(compose, /postgres:[\s\S]*?healthcheck:[\s\S]*?pg_isready/)
  assert.match(compose, /redis:[\s\S]*?healthcheck:[\s\S]*?redis-cli/)
})

test('production readiness: README documents /api/ 180s proxy timeouts', () => {
  const readme = read('README.md')
  assert.match(readme, /location \/api\/ \{[\s\S]*?proxy_read_timeout 180s/)
  assert.match(readme, /proxy_send_timeout 180s/)
})

test('production readiness: env example documents AI gate and cookie Secure', () => {
  const env = read('.env.example')
  assert.match(env, /AI_FEATURES_ENABLED/)
  assert.match(env, /VITE_AI_FEATURES_ENABLED/)
  assert.match(env, /COOKIE_SECURE/)
  assert.match(env, /ENABLE_API_DOCS/)
})

test('production readiness: tracked app ERD fixture exists', () => {
  const fixture = read('apps/web/src/fixtures/erd-studio-app.erd.json')
  assert.match(fixture, /"kind": "erd-studio"/)
  assert.match(fixture, /"physicalName": "TeamMember"/)
  assert.match(fixture, /"physicalName": "UserActivityDay"/)
})

test('production readiness: Prisma composite @@id order is documented in schema', () => {
  const prisma = read('apps/api/prisma/schema.prisma')
  assert.match(
    prisma,
    /model TeamMember \{[\s\S]*?@@id\(\[teamId, userId\]\)/,
  )
  assert.match(
    prisma,
    /model ProjectMember \{[\s\S]*?@@id\(\[projectId, userId\]\)/,
  )
  assert.match(
    prisma,
    /model UserActivityDay \{[\s\S]*?@@id\(\[day, userId\]\)/,
  )
})
