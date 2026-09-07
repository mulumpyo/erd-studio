import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common'
import { lookup as dnsLookup } from 'node:dns/promises'
import https from 'node:https'
import type { ErdDocument } from '@erd-studio/shared'
import { normalizeDocument } from '@erd-studio/shared'
import { sanitizeAiDocument } from './ai-local'
import {
  buildChatUserPayload,
  resolveChatDocument,
  trimChatHistory,
} from './ai-chat-context'

export type AiProvider = 'openai' | 'gemini' | 'other'

type GenerateResult = {
  document: ErdDocument
  source: AiProvider
}

type ChatResult = {
  message: string
  document?: ErdDocument
  applied: boolean
  source: AiProvider
}

type GenerateOptions = {
  prompt: string
  apiKey: string
  provider: AiProvider
  model?: string
  hint?: string
  baseUrl?: string
}

type ChatOptions = {
  message: string
  apiKey: string
  provider: AiProvider
  document: unknown
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  model?: string
  baseUrl?: string
}

/** Slim shapes for generate/chat — notes/settings filled server-side. */
const TABLE_SHAPE = `{
  "id":"tbl_...","logicalName":"한글","physicalName":"snake_case","color":"#3b82f6",
  "position":{"x":80,"y":80},
  "columns":[{"id":"col_...","logicalName":"...","physicalName":"...","type":"int|varchar|text|boolean|datetime|decimal","length":"255"|null,"pk":true,"fk":false,"nn":true,"unique":false,"autoIncrement":true}]
}`

const RELATION_SHAPE = `{
  "id":"rel_...","sourceTableId":"tbl_...","targetTableId":"tbl_...",
  "sourceColumnIds":["col_..."],"targetColumnIds":["col_..."],
  "kind":"non-identifying","sourceCardinality":"N","targetCardinality":"1"
}`

const COLUMN_SHAPE = `{"id":"col_...","logicalName":"...","physicalName":"...","type":"varchar","length":"255","nn":true}`

const SYSTEM_PROMPT = `You are an ERD assistant for ERD Studio.
Return ONLY JSON: {"tables":[${TABLE_SHAPE}],"relations":[${RELATION_SHAPE}]}
Rules:
- Max 20 tables. Every table needs a PK id column (int, autoIncrement).
- Prefer Korean logicalName and English snake_case physicalName.
- Layout tables in a grid (x += 280, y += 220).
- Add simple FK relations when clear.
- Omit notes/domains/settings.
- No markdown fences.`

const CHAT_SYSTEM_PROMPT = `ERD Studio co-pilot. Reply with ONLY JSON (no markdown).
Short Korean "message" plus one of: patch | unchanged | document.

Column edit (preferred):
{"message":"...","patch":{"upsertColumns":[{"tableId":"tbl_...","columns":[${COLUMN_SHAPE}],"removeColumnIds":[]}]}}

New/rewrite table or relation:
{"message":"...","patch":{"upsertTables":[${TABLE_SHAPE}],"removeTableIds":[],"upsertRelations":[${RELATION_SHAPE}],"removeRelationIds":[]}}

No diagram change: {"message":"...","unchanged":true}

Empty diagram / mostly rewrite only:
{"message":"...","document":{"tables":[${TABLE_SHAPE}],"relations":[${RELATION_SHAPE}]}}

Rules:
- Prefer upsertColumns for column-only edits; never echo untouched tables/columns.
- upsertTables = FULL tables when adding/rewriting a table.
- Keep existing ids; new ids tbl_/col_/rel_. If rewriting most tables use removeTableIds or a full document with new ids.
- ≤20 tables; each needs PK id (int, autoIncrement) unless present.
- Korean logicalName, English snake_case physicalName.
- Stable positions; new tables near existing (x+=280,y+=220).
- Ignore notes/domains/settings.`

export const AI_PROVIDERS: Record<
  'openai' | 'gemini',
  { baseUrl: string; defaultModel: string; label: string }
> = {
  openai: {
    label: 'ChatGPT',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
  },
  gemini: {
    label: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
  },
}

const BLOCKED_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.google.com',
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
])

const isIpv4 = (host: string) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)

const ipv4ToInt = (host: string) => {
  const parts = host.split('.').map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null
  }
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!
}

const inCidr = (ip: number, base: string, bits: number) => {
  const baseInt = ipv4ToInt(base)
  if (baseInt == null) return false
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ip & mask) === (baseInt & mask)
}

/** Block localhost / link-local / private / metadata hosts for custom base URLs. */
export const isBlockedCompatibleHost = (hostname: string) => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (BLOCKED_HOSTS.has(host)) return true
  if (host === '::1' || host === '::' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true
  }
  if (host.includes(':')) {
    // Basic IPv6 local/unique-local checks.
    if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true
  }
  if (!isIpv4(host)) return false
  const ip = ipv4ToInt(host)
  if (ip == null) return true
  return (
    inCidr(ip, '0.0.0.0', 8) ||
    inCidr(ip, '10.0.0.0', 8) ||
    inCidr(ip, '127.0.0.0', 8) ||
    inCidr(ip, '169.254.0.0', 16) ||
    inCidr(ip, '172.16.0.0', 12) ||
    inCidr(ip, '192.168.0.0', 16)
  )
}

export type CompatibleHostLookup = (
  hostname: string,
) => Promise<Array<{ address: string; family: number }>>

const defaultCompatibleLookup: CompatibleHostLookup = async (hostname) =>
  dnsLookup(hostname, { all: true })

/**
 * Resolve hostname and reject if any address is private/link-local/metadata.
 * Call before outbound `other` provider requests (DNS-rebinding defense).
 */
export const assertResolvedCompatibleHost = async (
  hostname: string,
  lookupFn: CompatibleHostLookup = defaultCompatibleLookup,
) => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (isBlockedCompatibleHost(host)) {
    throw new BadRequestException('이 호스트로는 요청할 수 없어요.')
  }
  let results: Array<{ address: string; family: number }>
  try {
    results = await lookupFn(host)
  } catch {
    throw new BadRequestException('호스트를 해석하지 못했어요.')
  }
  if (!results.length) {
    throw new BadRequestException('호스트를 해석하지 못했어요.')
  }
  for (const entry of results) {
    if (isBlockedCompatibleHost(entry.address)) {
      throw new BadRequestException('이 호스트로는 요청할 수 없어요.')
    }
  }
  return results
}

/** Fetch an OpenAI-compatible URL after DNS resolve + IP pin (anti-rebinding). */
export const fetchCompatibleUrl = async (
  url: string,
  init?: RequestInit,
  lookupFn: CompatibleHostLookup = defaultCompatibleLookup,
): Promise<Response> => {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') {
    throw new BadRequestException('기타 제공자는 https 베이스 URL만 쓸 수 있어요.')
  }
  const addrs = await assertResolvedCompatibleHost(parsed.hostname, lookupFn)
  const pinned = addrs[0]!
  const method = (init?.method || 'GET').toUpperCase()
  const headerBag = new Headers(init?.headers)
  if (!headerBag.has('host')) headerBag.set('host', parsed.host)
  const headers: Record<string, string> = {}
  headerBag.forEach((value, key) => {
    headers[key] = value
  })
  const body =
    typeof init?.body === 'string'
      ? init.body
      : init?.body != null
        ? String(init.body)
        : undefined

  return new Promise<Response>((resolve, reject) => {
    const req = https.request(
      {
        protocol: 'https:',
        hostname: pinned.address,
        servername: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers,
        lookup: (_hostname, _options, callback) => {
          callback(null, pinned.address, pinned.family)
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(chunk as Buffer))
        res.on('end', () => {
          const buf = Buffer.concat(chunks)
          const outHeaders = new Headers()
          for (const [key, value] of Object.entries(res.headers)) {
            if (value == null) continue
            if (Array.isArray(value)) outHeaders.set(key, value.join(', '))
            else outHeaders.set(key, value)
          }
          resolve(
            new Response(buf, {
              status: res.statusCode || 0,
              statusText: res.statusMessage || '',
              headers: outHeaders,
            }),
          )
        })
      },
    )
    req.on('error', reject)
    if (body != null) req.write(body)
    req.end()
  })
}

/** Normalize OpenAI-compatible base URL (https only). */
export const resolveCompatibleBaseUrl = (raw: string): string => {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new BadRequestException('베이스 URL을 입력해 주세요.')
  }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new BadRequestException('베이스 URL 형식이 올바르지 않아요.')
  }
  if (url.protocol !== 'https:') {
    throw new BadRequestException('기타 제공자는 https 베이스 URL만 쓸 수 있어요.')
  }
  if (url.username || url.password) {
    throw new BadRequestException('베이스 URL에 계정 정보를 넣지 마세요.')
  }
  const host = url.hostname.toLowerCase()
  if (isBlockedCompatibleHost(host)) {
    throw new BadRequestException('이 호스트로는 요청할 수 없어요.')
  }
  let path = url.pathname.replace(/\/+$/, '') || ''
  if (!path || path === '/') path = '/v1'
  return `${url.origin}${path}`
}

/** Build `.../chat/completions` for an allowlisted or custom base. */
export const resolveChatCompletionsUrl = (
  provider: AiProvider,
  baseUrl?: string,
): string => {
  if (provider === 'other') {
    return `${resolveCompatibleBaseUrl(baseUrl || '')}/chat/completions`
  }
  const conf = AI_PROVIDERS[provider]
  if (!conf) {
    throw new BadRequestException('지원하지 않는 AI 제공자예요.')
  }
  const base = conf.baseUrl.replace(/\/+$/, '')
  return `${base}/chat/completions`
}

export const resolveModelsUrl = (provider: AiProvider, baseUrl?: string) => {
  if (provider === 'other') {
    return `${resolveCompatibleBaseUrl(baseUrl || '')}/models`
  }
  if (provider === 'openai') return 'https://api.openai.com/v1/models'
  return null
}

export type AiUpstreamKind = 'chat' | 'models'

const extractUpstreamErrorText = (body: string): string => {
  const raw = body.trim()
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw) as {
      error?:
        | string
        | {
            message?: string
            type?: string
            code?: string | number
            status?: string
          }
      message?: string
      detail?: string
    }
    if (typeof parsed.error === 'string') return parsed.error
    if (parsed.error && typeof parsed.error === 'object') {
      const parts = [
        parsed.error.message,
        parsed.error.type,
        parsed.error.code != null ? String(parsed.error.code) : '',
        parsed.error.status,
      ]
        .filter(Boolean)
        .join(' ')
      if (parts) return parts
    }
    if (typeof parsed.message === 'string') return parsed.message
    if (typeof parsed.detail === 'string') return parsed.detail
  } catch {
    /* plain text body */
  }
  return raw.slice(0, 240)
}

const includesAny = (haystack: string, needles: string[]) =>
  needles.some((needle) => haystack.includes(needle))

/** Map upstream provider HTTP failures to short Korean UX copy. */
export const describeAiUpstreamError = (
  status: number,
  body: string,
  kind: AiUpstreamKind = 'chat',
): string => {
  const detail = extractUpstreamErrorText(body)
  const lower = detail.toLowerCase()
  const isModels = kind === 'models'
  const failVerb = isModels
    ? '모델 목록을 가져오지 못했어요'
    : '답변을 받지 못했어요'

  if (
    status === 401 ||
    status === 403 ||
    includesAny(lower, [
      'invalid_api_key',
      'incorrect api key',
      'invalid api key',
      'api key not valid',
      'api_key_invalid',
      'unauthorized',
      'authentication',
      'permission_denied',
      'permission denied',
      'access denied',
      'not allowed',
    ])
  ) {
    if (
      includesAny(lower, ['permission', 'not allowed', 'access denied']) &&
      status !== 401
    ) {
      return isModels
        ? '이 API 키로는 모델 목록을 볼 권한이 없어요. 키 권한을 확인해 주세요.'
        : '이 API 키로는 선택한 모델에 접근할 권한이 없어요. 키·모델 권한을 확인해 주세요.'
    }
    return `API 키가 올바르지 않거나 만료돼서 ${failVerb}. 키를 다시 확인해 주세요.`
  }

  if (
    status === 402 ||
    includesAny(lower, [
      'insufficient_quota',
      'insufficient quota',
      'billing_not_active',
      'billing hard limit',
      'exceeded your current quota',
      'quota exceeded',
      'credit',
      'balance',
      'payment required',
      'payment_required',
      'no credits',
      'out of credits',
      'spend limit',
    ])
  ) {
    return isModels
      ? '크레딧(사용 한도)이 부족해서 모델 목록을 가져오지 못했어요. 제공자 계정 결제·사용량을 확인해 주세요.'
      : '크레딧(사용 한도)이 부족해서 답변을 받지 못했어요. 제공자 계정 결제·사용량을 확인해 주세요.'
  }

  if (
    status === 429 ||
    includesAny(lower, [
      'rate_limit',
      'rate limit',
      'too many requests',
      'resource_exhausted',
      'resource exhausted',
      'quota_exceeded',
    ])
  ) {
    if (includesAny(lower, ['quota', 'credit', 'billing'])) {
      return isModels
        ? '크레딧(사용 한도)이 부족해서 모델 목록을 가져오지 못했어요. 제공자 계정 결제·사용량을 확인해 주세요.'
        : '크레딧(사용 한도)이 부족해서 답변을 받지 못했어요. 제공자 계정 결제·사용량을 확인해 주세요.'
    }
    return '요청이 너무 많아서 잠시 막혔어요. 잠시 후 다시 시도해 주세요.'
  }

  if (
    includesAny(lower, [
      'model_not_found',
      'model not found',
      'does not exist',
      'invalid model',
      'unknown model',
      'not a valid model',
      'no such model',
    ]) ||
    (status === 404 && includesAny(lower, ['model']))
  ) {
    return '선택한 모델을 찾을 수 없어요. 다른 모델을 고르거나 모델 id를 확인해 주세요.'
  }

  if (
    includesAny(lower, [
      'context_length',
      'context length',
      'maximum context',
      'too many tokens',
      'token limit',
      'max_tokens',
      'prompt is too long',
      'input is too long',
    ])
  ) {
    return '입력이 너무 길어서 처리하지 못했어요. 대화를 줄이거나 다이어그램을 단순화해 보세요.'
  }

  if (
    includesAny(lower, [
      'content_filter',
      'content filter',
      'safety',
      'blocked',
      'responsibleai',
      'moderation',
    ])
  ) {
    return '제공자 안전 정책에 걸려 응답이 막혔어요. 문구를 바꿔 다시 시도해 주세요.'
  }

  if (status === 404) {
    return isModels
      ? '모델 목록 API 주소를 찾지 못했어요. 베이스 URL이 OpenAI 호환(/v1)인지 확인해 주세요.'
      : '채팅 API 주소를 찾지 못했어요. 베이스 URL이 OpenAI 호환(/v1)인지 확인해 주세요.'
  }

  if (status >= 500) {
    return 'AI 제공자 서버에 문제가 있는 것 같아요. 잠시 후 다시 시도해 주세요.'
  }

  if (status === 400) {
    return detail
      ? `요청을 처리하지 못했어요. ${detail.slice(0, 160)}`
      : '요청을 처리하지 못했어요. 모델·키·베이스 URL을 확인해 주세요.'
  }

  return detail
    ? `${failVerb} (${status}). ${detail.slice(0, 160)}`
    : `${failVerb} (${status}).`
}

export const describeAiNetworkError = (
  error: unknown,
  kind: AiUpstreamKind = 'chat',
): string => {
  const detail = error instanceof Error ? error.message : String(error)
  const lower = detail.toLowerCase()
  const failVerb =
    kind === 'models'
      ? '모델 목록 서버에 연결하지 못했어요'
      : 'AI 서버에 연결하지 못했어요'
  if (
    includesAny(lower, [
      'enotfound',
      'getaddrinfo',
      'econnrefused',
      'econnreset',
      'etimedout',
      'network',
      'fetch failed',
      'certificate',
      'ssl',
      'tls',
    ])
  ) {
    return `${failVerb}. 네트워크와 베이스 URL을 확인해 주세요.`
  }
  return `${failVerb}. (${detail.slice(0, 120)})`
}

const OPENAI_CHAT_RE =
  /^(gpt-|o[1-9]|chatgpt-|ft:gpt-|ft:o[1-9])/i
const OPENAI_EXCLUDE_RE =
  /embedding|whisper|tts|dall-e|moderation|realtime|transcribe|image|audio|search|computer-use|codex|babbage|davinci|ada|curie/i

/** Keep chat-capable OpenAI model ids only. */
export const filterOpenAiChatModels = (ids: string[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    const name = id.trim()
    if (!name || seen.has(name)) continue
    if (!OPENAI_CHAT_RE.test(name) || OPENAI_EXCLUDE_RE.test(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out.sort((a, b) => a.localeCompare(b))
}

/** Keep Gemini models that support generateContent. */
export const filterGeminiChatModels = (
  models: Array<{ name?: string; supportedGenerationMethods?: string[] }>,
): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of models) {
    const methods = item.supportedGenerationMethods || []
    if (!methods.includes('generateContent')) continue
    const raw = (item.name || '').trim()
    if (!raw) continue
    const id = raw.replace(/^models\//, '')
    if (!id || seen.has(id)) continue
    if (/embedding|imagen|aqa|gecko|text-embedding/i.test(id)) continue
    if (!/^gemini-/i.test(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out.sort((a, b) => a.localeCompare(b))
}

/** Keep chat-capable ids for OpenAI-compatible catalogs (NVIDIA 등). */
export const filterCompatibleChatModels = (ids: string[]): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of ids) {
    const name = id.trim()
    if (!name || seen.has(name)) continue
    if (OPENAI_EXCLUDE_RE.test(name)) continue
    if (/embedding|rerank|whisper|tts|dall-e|imagen/i.test(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out.sort((a, b) => a.localeCompare(b))
}

const preferDefaultFirst = (ids: string[], preferred: string) => {
  if (!preferred || !ids.includes(preferred)) return ids
  return [preferred, ...ids.filter((id) => id !== preferred)]
}

/** Hard cap on chat wire document size (related-table context still truncates further). */
const MAX_AI_CHAT_TABLES = 400

const fingerprint = (doc: ErdDocument) =>
  JSON.stringify({
    tables: doc.tables.map((t) => ({
      id: t.id,
      logicalName: t.logicalName,
      physicalName: t.physicalName,
      columns: t.columns.map((c) => ({
        id: c.id,
        logicalName: c.logicalName,
        physicalName: c.physicalName,
        type: c.type,
        pk: c.pk,
        fk: c.fk,
      })),
    })),
    relations: doc.relations.map((r) => ({
      id: r.id,
      sourceTableId: r.sourceTableId,
      targetTableId: r.targetTableId,
      sourceColumnIds: r.sourceColumnIds,
      targetColumnIds: r.targetColumnIds,
    })),
  })

@Injectable()
export class AiService {
  status = () => ({
    available: true as const,
    requiresApiKey: true as const,
    providers: ['openai', 'gemini', 'other'] as AiProvider[],
    defaultModels: {
      openai: AI_PROVIDERS.openai.defaultModel,
      gemini: AI_PROVIDERS.gemini.defaultModel,
      other: '',
    },
  })

  listModels = async (
    provider: AiProvider,
    apiKey: string,
    baseUrl?: string,
  ) => {
    if (provider !== 'openai' && provider !== 'gemini' && provider !== 'other') {
      throw new BadRequestException('지원하지 않는 AI 제공자예요.')
    }
    const key = apiKey.trim()
    if (key.length < 8) {
      throw new BadRequestException('AI API 키를 입력해 주세요.')
    }
    let ids: string[]
    let preferred = ''
    if (provider === 'openai') {
      ids = await this.fetchOpenAiModels(key)
      preferred = AI_PROVIDERS.openai.defaultModel
    } else if (provider === 'gemini') {
      ids = await this.fetchGeminiModels(key)
      preferred = AI_PROVIDERS.gemini.defaultModel
    } else {
      ids = await this.fetchCompatibleModels(key, baseUrl)
    }
    const ordered = preferDefaultFirst(ids, preferred)
    if (!ordered.length) {
      throw new ServiceUnavailableException(
        '쓸 수 있는 채팅 모델을 찾지 못했어요. API 키·베이스 URL을 확인해 주세요.',
      )
    }
    return {
      models: ordered.map((id) => ({ id, label: id })),
      defaultModel: ordered.includes(preferred) ? preferred : ordered[0],
    }
  }

  generate = async (opts: GenerateOptions): Promise<GenerateResult> => {
    const text = opts.prompt.trim()
    if (text.length < 2) {
      throw new BadRequestException('무엇을 만들지 조금 더 적어 주세요.')
    }
    const started = Date.now()
    const { provider, key, model, chatUrl, jsonMode, pinDns } =
      this.resolveProvider(opts)
    const userContent = opts.hint?.trim()
      ? `요청: ${text}\n힌트: ${opts.hint.trim()}`
      : `요청: ${text}`
    try {
      const parsed = await this.callCompatibleApi({
        chatUrl,
        key,
        model,
        jsonMode,
        pinDns,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      })
      console.info(
        `[ai] generate provider=${provider} model=${model} ok=1 ms=${Date.now() - started}`,
      )
      return { document: sanitizeAiDocument(parsed), source: provider }
    } catch (error) {
      console.info(
        `[ai] generate provider=${provider} model=${model} ok=0 ms=${Date.now() - started}`,
      )
      throw error
    }
  }

  chat = async (opts: ChatOptions): Promise<ChatResult> => {
    const text = opts.message.trim()
    if (!text) {
      throw new BadRequestException('메시지를 입력해 주세요.')
    }
    const started = Date.now()
    const { provider, key, model, chatUrl, jsonMode, pinDns } =
      this.resolveProvider(opts)
    const current = normalizeDocument(opts.document)
    if (current.tables.length > MAX_AI_CHAT_TABLES) {
      throw new BadRequestException(
        `AI 채팅은 테이블 ${MAX_AI_CHAT_TABLES}개까지 지원해요. 범위를 줄여 주세요.`,
      )
    }
    const history = trimChatHistory(opts.history)
    const userPayload = buildChatUserPayload(current, text, history)
    try {
      const parsed = await this.callCompatibleApi({
        chatUrl,
        key,
        model,
        jsonMode,
        pinDns,
        messages: [
          { role: 'system', content: CHAT_SYSTEM_PROMPT },
          ...history,
          { role: 'user', content: userPayload },
        ],
      })
      const message =
        typeof (parsed as { message?: unknown }).message === 'string'
          ? (parsed as { message: string }).message.trim()
          : '다이어그램을 반영했어요.'
      const resolved = resolveChatDocument(current, parsed)
      const document = resolved.document
      const applied = fingerprint(current) !== fingerprint(document)
      console.info(
        `[ai] chat provider=${provider} mode=${resolved.mode} applied=${applied} tables=${current.tables.length} ms=${Date.now() - started}`,
      )
      return {
        message: message || '다이어그램을 반영했어요.',
        ...(applied ? { document } : {}),
        applied,
        source: provider,
      }
    } catch (error) {
      console.info(
        `[ai] chat provider=${provider} ok=0 tables=${current.tables.length} ms=${Date.now() - started}`,
      )
      throw error
    }
  }

  private resolveProvider = (opts: {
    provider: AiProvider
    apiKey: string
    model?: string
    baseUrl?: string
  }) => {
    const provider = opts.provider
    if (provider !== 'openai' && provider !== 'gemini' && provider !== 'other') {
      throw new BadRequestException('지원하지 않는 AI 제공자예요.')
    }
    const key = opts.apiKey.trim()
    if (key.length < 8) {
      throw new BadRequestException('AI API 키를 입력해 주세요.')
    }
    const preferred =
      provider === 'other' ? '' : AI_PROVIDERS[provider].defaultModel
    const model = (opts.model || '').trim() || preferred
    if (!model) {
      throw new BadRequestException('모델을 선택해 주세요.')
    }
    return {
      provider,
      key,
      model,
      chatUrl: resolveChatCompletionsUrl(provider, opts.baseUrl),
      jsonMode: provider !== 'other',
      pinDns: provider === 'other',
    }
  }

  private fetchOpenAiModels = async (key: string): Promise<string[]> => {
    return filterOpenAiChatModels(
      await this.fetchModelsCatalog('https://api.openai.com/v1/models', key),
    )
  }

  private fetchCompatibleModels = async (
    key: string,
    baseUrl?: string,
  ): Promise<string[]> => {
    const url = resolveModelsUrl('other', baseUrl)
    if (!url) return []
    return filterCompatibleChatModels(
      await this.fetchModelsCatalog(url, key, { pinDns: true }),
    )
  }

  private fetchModelsCatalog = async (
    url: string,
    key: string,
    opts?: { pinDns?: boolean },
  ): Promise<string[]> => {
    let res: Response
    try {
      res = opts?.pinDns
        ? await fetchCompatibleUrl(url, {
            headers: { Authorization: `Bearer ${key}` },
          })
        : await fetch(url, {
            headers: { Authorization: `Bearer ${key}` },
          })
    } catch (error) {
      if (error instanceof BadRequestException) throw error
      throw new ServiceUnavailableException(
        describeAiNetworkError(error, 'models'),
      )
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new ServiceUnavailableException(
        describeAiUpstreamError(res.status, body, 'models'),
      )
    }
    const data = (await res.json()) as { data?: Array<{ id?: string }> }
    return (data.data || []).map((item) => item.id || '').filter(Boolean)
  }

  private fetchGeminiModels = async (key: string): Promise<string[]> => {
    let res: Response
    try {
      res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models',
        { headers: { 'x-goog-api-key': key } },
      )
    } catch (error) {
      throw new ServiceUnavailableException(
        describeAiNetworkError(error, 'models'),
      )
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new ServiceUnavailableException(
        describeAiUpstreamError(res.status, body, 'models'),
      )
    }
    const data = (await res.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>
    }
    return filterGeminiChatModels(data.models || [])
  }

  private callCompatibleApi = async (args: {
    chatUrl: string
    key: string
    model: string
    messages: Array<{ role: string; content: string }>
    jsonMode?: boolean
    pinDns?: boolean
  }): Promise<unknown> => {
    const run = async (useJsonMode: boolean) => {
      const body: Record<string, unknown> = {
        model: args.model,
        temperature: 0.2,
        messages: args.messages,
      }
      if (useJsonMode) {
        body.response_format = { type: 'json_object' }
      }
      const init: RequestInit = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${args.key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
      let res: Response
      try {
        res = args.pinDns
          ? await fetchCompatibleUrl(args.chatUrl, init)
          : await fetch(args.chatUrl, init)
      } catch (error) {
        if (error instanceof BadRequestException) throw error
        throw new ServiceUnavailableException(
          describeAiNetworkError(error, 'chat'),
        )
      }
      return res
    }

    let useJsonMode = args.jsonMode !== false
    let res = await run(useJsonMode)
    // Some OpenAI-compatible gateways reject response_format — retry once plain.
    if (!res.ok && useJsonMode && (res.status === 400 || res.status === 422)) {
      const errBody = await res.text().catch(() => '')
      if (
        /response_format|json_object|unknown.?parameter|unsupported/i.test(
          errBody,
        )
      ) {
        useJsonMode = false
        res = await run(false)
      } else {
        throw new ServiceUnavailableException(
          describeAiUpstreamError(res.status, errBody, 'chat'),
        )
      }
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      throw new ServiceUnavailableException(
        describeAiUpstreamError(res.status, errBody, 'chat'),
      )
    }
    const data = (await res.json()) as {
      choices?: Array<{
        message?: { content?: string }
        finish_reason?: string
      }>
    }
    const choice = data.choices?.[0]
    const content = choice?.message?.content
    const finish = (choice?.finish_reason || '').toLowerCase()
    if (!content) {
      if (includesAny(finish, ['content_filter', 'safety'])) {
        throw new ServiceUnavailableException(
          '제공자 안전 정책에 걸려 응답이 막혔어요. 문구를 바꿔 다시 시도해 주세요.',
        )
      }
      if (includesAny(finish, ['length'])) {
        throw new ServiceUnavailableException(
          '응답이 길이 한도에 걸려 비어 있어요. 요청을 짧게 나눠 다시 시도해 주세요.',
        )
      }
      throw new ServiceUnavailableException(
        'AI 응답이 비어 있어요. 모델이 채팅을 지원하는지 확인해 주세요.',
      )
    }
    const parsed = parseModelJson(content)
    if (parsed != null) return parsed
    throw new BadRequestException(
      'AI가 다이어그램 JSON 형식으로 답하지 않았어요. 같은 요청을 다시 보내 보세요.',
    )
  }
}

/** Extract JSON object/array from model text (fences / leading prose). */
export const parseModelJson = (content: string): unknown | null => {
  const trimmed = content.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] || trimmed).trim()
  try {
    return JSON.parse(candidate)
  } catch {
    const startObj = candidate.indexOf('{')
    const startArr = candidate.indexOf('[')
    const start =
      startObj < 0
        ? startArr
        : startArr < 0
          ? startObj
          : Math.min(startObj, startArr)
    if (start < 0) return null
    const opener = candidate[start]
    const closer = opener === '{' ? '}' : ']'
    const end = candidate.lastIndexOf(closer)
    if (end <= start) return null
    try {
      return JSON.parse(candidate.slice(start, end + 1))
    } catch {
      return null
    }
  }
}
