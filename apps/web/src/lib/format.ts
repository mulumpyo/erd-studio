export const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export const initialOf = (name: string) =>
  name.trim().slice(0, 1).toUpperCase() || '?'

export const roleLabel = (role: string) => {
  if (role === 'owner') return '소유자'
  if (role === 'viewer') return '보기'
  return '편집'
}

const startOfLocalDay = (ts: number) => {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export const sameLocalDay = (a: number, b: number) =>
  startOfLocalDay(a) === startOfLocalDay(b)

export const formatChatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

export const formatChatDate = (ts: number) => {
  const day = startOfLocalDay(ts)
  const today = startOfLocalDay(Date.now())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (day === today) return '오늘'
  if (day === yesterday.getTime()) return '어제'
  const date = new Date(ts)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString('ko-KR', {
    ...(sameYear ? {} : { year: 'numeric' as const }),
    month: 'long',
    day: 'numeric',
  })
}
