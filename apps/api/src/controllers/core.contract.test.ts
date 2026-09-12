import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ServiceUnavailableException } from '@nestjs/common'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import {
  aiFeaturesEnabled,
  assertAiEnabled,
  disabledAiStatus,
} from '../common/ai-features'
import { AiController } from './ai.controller'
import { GenerateErdDto } from '../dto/ai.dto'
import { HealthController } from './health.controller'

const withEnv = async (
  key: string,
  value: string | undefined,
  fn: () => void | Promise<void>,
) => {
  const prev = process.env[key]
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
  try {
    await fn()
  } finally {
    if (prev === undefined) delete process.env[key]
    else process.env[key] = prev
  }
}

test('contract: AI off → status unavailable; mutating routes 503', async () => {
  await withEnv('AI_FEATURES_ENABLED', undefined, () => {
    assert.equal(aiFeaturesEnabled(), false)
    const status = disabledAiStatus()
    assert.equal(status.available, false)
    assert.equal(status.requiresApiKey, true)
    assert.deepEqual(status.providers, [])

    assert.throws(() => assertAiEnabled(), ServiceUnavailableException)

    const ctrl = new AiController({
      status: () => {
        throw new Error('should not call upstream when gated')
      },
    } as never)
    assert.deepEqual(ctrl.status(), disabledAiStatus())
    assert.throws(
      () =>
        ctrl.generate({
          prompt: 'blog',
          apiKey: 'sk-test-key-long',
          provider: 'openai',
        }),
      ServiceUnavailableException,
    )
    assert.throws(
      () =>
        ctrl.chat({
          message: 'hello',
          apiKey: 'sk-test-key-long',
          provider: 'openai',
          document: { tables: [], relations: [], notes: [], domains: [], schemas: [], settings: { dialect: 'postgres', nameMode: 'both' } },
        } as never),
      ServiceUnavailableException,
    )
    assert.throws(
      () =>
        ctrl.listModels({
          provider: 'openai',
          apiKey: 'sk-test-key-long',
        }),
      ServiceUnavailableException,
    )
  })
})

test('contract: AI on → status delegates to service', async () => {
  await withEnv('AI_FEATURES_ENABLED', 'true', () => {
    assert.equal(aiFeaturesEnabled(), true)
    const payload = {
      available: true as const,
      requiresApiKey: true as const,
      providers: ['openai'] as const,
      defaultModels: { openai: 'gpt-4o-mini', gemini: '', other: '' },
    }
    const ctrl = new AiController({
      status: () => payload,
    } as never)
    assert.deepEqual(ctrl.status(), payload)
  })
})

test('contract: GenerateErdDto rejects short prompt (400 shape)', async () => {
  const dto = plainToInstance(GenerateErdDto, {
    prompt: 'x',
    apiKey: 'sk-short',
    provider: 'openai',
  })
  const errors = await validate(dto)
  assert.ok(errors.length >= 1)
  const fields = errors.map((e) => e.property)
  assert.ok(fields.includes('prompt') || fields.includes('apiKey'))
})

test('contract: health reports redis via ping', async () => {
  const ctrl = new HealthController({
    ping: async () => true,
  } as never)
  const body = await ctrl.health()
  assert.equal(typeof body.ok, 'boolean')
  if ('service' in body) {
    assert.equal(body.service, 'erd-studio-api')
    assert.equal(body.redis, true)
  } else {
    assert.equal(body.ok, true)
  }
})
