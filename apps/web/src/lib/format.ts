export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export const initialOf = (name: string) =>
  name.trim().slice(0, 1).toUpperCase() || '?'

export const roleLabel = (role: string) => {
  if (role === 'owner') return '소유자'
  if (role === 'viewer') return '보기'
  return '편집'
}
