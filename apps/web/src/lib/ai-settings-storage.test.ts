import { describe, expect, it } from 'vitest'
import {
  aiSettingsStorageKey,
  loadAiSettings,
  persistAiSettings,
  type AiSettingsPayload,
} from './ai-settings-storage'

const memoryStorage = () => {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v)
    },
    removeItem: (k: string) => {
      map.delete(k)
    },
  }
}

describe('ai-settings-storage', () => {
  it('scopes keys by user id', () => {
    expect(aiSettingsStorageKey('u1')).toBe('erd_ai_settings:u1')
    expect(aiSettingsStorageKey(null)).toBeNull()
  })

  it('persists to sessionStorage and clears localStorage', () => {
    const session = memoryStorage()
    const local = memoryStorage()
    const key = 'erd_ai_settings:u1'
    const payload: AiSettingsPayload = {
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
    }
    expect(persistAiSettings(key, payload, session, local)).toBe(true)
    expect(session.getItem(key)).toContain('sk-test')
    expect(local.getItem(key)).toBeNull()
  })

  it('migrates legacy localStorage into sessionStorage once', () => {
    const session = memoryStorage()
    const local = memoryStorage()
    const key = 'erd_ai_settings:u1'
    local.setItem(
      key,
      JSON.stringify({
        provider: 'gemini',
        apiKey: 'AQ.legacy',
        model: 'gemini-2.0-flash',
      }),
    )
    const loaded = loadAiSettings(key, session, local)
    expect(loaded?.apiKey).toBe('AQ.legacy')
    expect(session.getItem(key)).toContain('AQ.legacy')
    expect(local.getItem(key)).toBeNull()
  })

  it('prefers session over local and still clears local', () => {
    const session = memoryStorage()
    const local = memoryStorage()
    const key = 'erd_ai_settings:u1'
    session.setItem(
      key,
      JSON.stringify({
        provider: 'openai',
        apiKey: 'sk-session',
        model: 'gpt-4o-mini',
      }),
    )
    local.setItem(
      key,
      JSON.stringify({
        provider: 'openai',
        apiKey: 'sk-local',
        model: 'gpt-4o-mini',
      }),
    )
    const loaded = loadAiSettings(key, session, local)
    expect(loaded?.apiKey).toBe('sk-session')
    expect(local.getItem(key)).toBeNull()
  })

  it('clears both stores when empty', () => {
    const session = memoryStorage()
    const local = memoryStorage()
    const key = 'erd_ai_settings:u1'
    session.setItem(key, '{}')
    local.setItem(key, '{}')
    expect(
      persistAiSettings(
        key,
        { provider: 'openai', apiKey: '', model: '' },
        session,
        local,
      ),
    ).toBe(false)
    expect(session.getItem(key)).toBeNull()
    expect(local.getItem(key)).toBeNull()
  })
})
