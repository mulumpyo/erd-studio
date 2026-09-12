import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assertResolvedCompatibleHost,
  describeAiNetworkError,
  describeAiUpstreamError,
  filterCompatibleChatModels,
  filterGeminiChatModels,
  filterOpenAiChatModels,
  isBlockedCompatibleHost,
  parseModelJson,
  resolveChatCompletionsUrl,
  resolveCompatibleBaseUrl,
} from './ai.service'

describe('resolveChatCompletionsUrl', () => {
  it('maps ChatGPT and Gemini to fixed OpenAI-compatible endpoints', () => {
    assert.equal(
      resolveChatCompletionsUrl('openai'),
      'https://api.openai.com/v1/chat/completions',
    )
    assert.equal(
      resolveChatCompletionsUrl('gemini'),
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    )
  })

  it('maps other provider from custom base URL', () => {
    assert.equal(
      resolveChatCompletionsUrl('other', 'https://integrate.api.nvidia.com/v1'),
      'https://integrate.api.nvidia.com/v1/chat/completions',
    )
  })
})

describe('resolveCompatibleBaseUrl', () => {
  it('rejects non-https and metadata hosts', () => {
    assert.throws(
      () => resolveCompatibleBaseUrl('http://example.com/v1'),
      /https/,
    )
    assert.throws(
      () => resolveCompatibleBaseUrl('https://169.254.169.254/v1'),
      /호스트/,
    )
  })

  it('rejects private LAN hosts', () => {
    assert.throws(
      () => resolveCompatibleBaseUrl('https://192.168.0.10/v1'),
      /호스트/,
    )
    assert.throws(
      () => resolveCompatibleBaseUrl('https://10.0.0.5/v1'),
      /호스트/,
    )
    assert.equal(isBlockedCompatibleHost('127.0.0.1'), true)
    assert.equal(isBlockedCompatibleHost('api.openai.com'), false)
  })
  it('rejects when DNS resolves to a private address', async () => {
    await assert.rejects(
      () =>
        assertResolvedCompatibleHost('evil.example', async () => [
          { address: '10.0.0.5', family: 4 },
        ]),
      /호스트/,
    )
  })

  it('allows when DNS resolves only to public addresses', async () => {
    const addrs = await assertResolvedCompatibleHost(
      'api.example.com',
      async () => [{ address: '1.1.1.1', family: 4 }],
    )
    assert.equal(addrs[0]?.address, '1.1.1.1')
  })
})

describe('parseModelJson', () => {
  it('parses fenced and prose-wrapped JSON', () => {
    assert.deepEqual(parseModelJson('```json\n{"a":1}\n```'), { a: 1 })
    assert.deepEqual(parseModelJson('여기요 {"message":"ok","unchanged":true} 끝'), {
      message: 'ok',
      unchanged: true,
    })
  })
})

describe('describeAiUpstreamError', () => {
  it('maps insufficient quota / credits', () => {
    const msg = describeAiUpstreamError(
      429,
      JSON.stringify({
        error: {
          message: 'You exceeded your current quota',
          type: 'insufficient_quota',
          code: 'insufficient_quota',
        },
      }),
      'chat',
    )
    assert.match(msg, /크레딧/)
  })

  it('maps invalid API key', () => {
    const msg = describeAiUpstreamError(
      401,
      JSON.stringify({
        error: {
          message: 'Incorrect API key provided',
          code: 'invalid_api_key',
        },
      }),
      'chat',
    )
    assert.match(msg, /API 키/)
  })

  it('maps rate limit without quota wording', () => {
    const msg = describeAiUpstreamError(
      429,
      JSON.stringify({
        error: { message: 'Rate limit exceeded', type: 'rate_limit' },
      }),
      'chat',
    )
    assert.match(msg, /너무 많아서/)
  })

  it('maps model not found', () => {
    const msg = describeAiUpstreamError(
      404,
      JSON.stringify({
        error: { message: 'The model `foo` does not exist' },
      }),
      'chat',
    )
    assert.match(msg, /모델/)
  })

  it('maps provider 5xx', () => {
    const msg = describeAiUpstreamError(503, 'upstream overloaded', 'models')
    assert.match(msg, /서버/)
  })
})

describe('describeAiNetworkError', () => {
  it('maps common connection failures', () => {
    const msg = describeAiNetworkError(new Error('fetch failed'), 'chat')
    assert.match(msg, /연결하지 못했어요/)
  })

  it('maps upstream timeouts', () => {
    const msg = describeAiNetworkError(
      new Error('ETIMEDOUT: AI upstream timeout'),
      'chat',
    )
    assert.match(msg, /너무 오래 걸려/)
  })
})

describe('filterOpenAiChatModels', () => {
  it('keeps chat models and drops embeddings / audio', () => {
    assert.deepEqual(
      filterOpenAiChatModels([
        'gpt-4o-mini',
        'text-embedding-3-small',
        'whisper-1',
        'o3-mini',
        'dall-e-3',
      ]),
      ['gpt-4o-mini', 'o3-mini'],
    )
  })
})

describe('filterCompatibleChatModels', () => {
  it('keeps NVIDIA-style model ids', () => {
    assert.deepEqual(
      filterCompatibleChatModels([
        'meta/llama3-70b-instruct',
        'text-embedding-3-small',
        'nvidia/llama-3.1-nemotron-70b-instruct',
      ]),
      [
        'meta/llama3-70b-instruct',
        'nvidia/llama-3.1-nemotron-70b-instruct',
      ],
    )
  })
})

describe('filterGeminiChatModels', () => {
  it('keeps generateContent gemini models', () => {
    assert.deepEqual(
      filterGeminiChatModels([
        {
          name: 'models/gemini-2.0-flash',
          supportedGenerationMethods: ['generateContent'],
        },
        {
          name: 'models/embedding-001',
          supportedGenerationMethods: ['embedContent'],
        },
        {
          name: 'models/gemini-1.5-pro',
          supportedGenerationMethods: ['generateContent', 'countTokens'],
        },
      ]),
      ['gemini-1.5-pro', 'gemini-2.0-flash'],
    )
  })
})
