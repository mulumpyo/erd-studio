export const apiOrigin = () => import.meta.env.VITE_API_URL || ''

/** Same-origin path only. Blocks protocol-relative and external URLs. */
export const safeInternalPath = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  if (value.includes('\\') || value.includes('://')) return null
  return value
}

export const collabUrl = () => {
  if (import.meta.env.VITE_COLLAB_URL) return import.meta.env.VITE_COLLAB_URL
  const protocol =
    typeof location !== 'undefined' && location.protocol === 'https:'
      ? 'wss:'
      : 'ws:'
  const host =
    typeof location !== 'undefined' ? location.host : 'localhost:5173'
  return `${protocol}//${host}/collaboration`
}

export const isSameOriginCollab = () => {
  if (import.meta.env.VITE_API_URL) return false
  if (!import.meta.env.VITE_COLLAB_URL) return true
  try {
    const target = new URL(import.meta.env.VITE_COLLAB_URL, location.href)
    return target.host === location.host
  } catch {
    return false
  }
}
