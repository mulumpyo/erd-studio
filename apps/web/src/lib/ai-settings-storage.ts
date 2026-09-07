export type AiProvider = 'openai' | 'gemini' | 'other'

export type AiSettingsPayload = {
  provider: AiProvider
  apiKey: string
  model: string
  baseUrl?: string
}

export const AI_SETTINGS_PREFIX = 'erd_ai_settings:'

export const aiSettingsStorageKey = (userId: string | null | undefined) =>
  userId ? `${AI_SETTINGS_PREFIX}${userId}` : null

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * Load AI settings. API keys live in sessionStorage only (tab-scoped).
 * Migrates once from legacy localStorage and clears the durable copy.
 */
export const loadAiSettings = (
  key: string,
  session: StorageLike,
  local: StorageLike,
): AiSettingsPayload | null => {
  try {
    const sessionRaw = session.getItem(key)
    if (sessionRaw) {
      local.removeItem(key)
      return JSON.parse(sessionRaw) as AiSettingsPayload
    }
    const legacy = local.getItem(key)
    if (!legacy) return null
    local.removeItem(key)
    const parsed = JSON.parse(legacy) as AiSettingsPayload
    if (parsed.apiKey || parsed.model || parsed.baseUrl) {
      session.setItem(key, JSON.stringify(parsed))
    }
    return parsed
  } catch {
    return null
  }
}

export const persistAiSettings = (
  key: string,
  payload: AiSettingsPayload,
  session: StorageLike,
  local: StorageLike,
) => {
  local.removeItem(key)
  if (payload.apiKey || payload.model || payload.baseUrl) {
    session.setItem(key, JSON.stringify(payload))
    return true
  }
  session.removeItem(key)
  return false
}
