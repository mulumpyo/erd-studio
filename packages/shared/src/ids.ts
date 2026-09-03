const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

export const fingerprint = (value: string): string => {
  let hash = FNV_OFFSET
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, FNV_PRIME)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const fallbackUuid = () =>
  `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`

export const createId = (prefix = 'id'): string => {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : fallbackUuid()
  return `${prefix}_${uuid}`
}

export const ensureStableId = (
  prefix: string,
  existing: string | undefined | null,
  seed: string,
): string => {
  const current = existing?.trim()
  if (current) return current
  return `${prefix}_${fingerprint(seed)}`
}
