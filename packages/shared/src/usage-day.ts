/** 사용량(DAU/WAU/MAU)은 한국 날짜를 기준으로 잘라요. */
export const USAGE_TIME_ZONE = 'Asia/Seoul'

export const USAGE_DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export const isUsageDay = (value: string) => USAGE_DAY_RE.test(value)

/** `YYYY-MM-DD` (Asia/Seoul). */
export const usageDayKey = (at: Date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: USAGE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at)

export const shiftUsageDay = (day: string, delta: number) => {
  const [year, month, date] = day.split('-').map(Number)
  const next = new Date(Date.UTC(year, month - 1, date + delta))
  return next.toISOString().slice(0, 10)
}

export const eachUsageDay = (from: string, to: string) => {
  const days: string[] = []
  let cursor = from
  while (cursor <= to) {
    days.push(cursor)
    cursor = shiftUsageDay(cursor, 1)
  }
  return days
}

export const redisUsageHitKey = (day: string, userId: string) =>
  `usage:hit:${day}:${userId}`

export const redisUsageDayKey = (day: string) => `usage:day:${day}`

/** 한국 날짜 하루의 시작·끝 (UTC Date). */
export const usageDayBounds = (day: string) => {
  const start = new Date(`${day}T00:00:00+09:00`)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { start, end }
}

/** 오늘 집합을 45일 동안 남겨 두어요. WAU/MAU 보정용이에요. */
export const REDIS_USAGE_TTL_SECONDS = 60 * 60 * 24 * 45

export type ActivityRow = { day: string; userId: string }

export type UsagePoint = { day: string; dau: number; wau: number; mau: number }

export const computeUsagePoint = (
  rows: ActivityRow[],
  day: string,
): UsagePoint => {
  const weekFrom = shiftUsageDay(day, -6)
  const monthFrom = shiftUsageDay(day, -29)
  const dau = new Set<string>()
  const wau = new Set<string>()
  const mau = new Set<string>()
  for (const row of rows) {
    if (row.day > day) continue
    if (row.day === day) dau.add(row.userId)
    if (row.day >= weekFrom) wau.add(row.userId)
    if (row.day >= monthFrom) mau.add(row.userId)
  }
  return { day, dau: dau.size, wau: wau.size, mau: mau.size }
}

export const computeUsageSeries = (
  rows: ActivityRow[],
  from: string,
  to: string,
): UsagePoint[] => eachUsageDay(from, to).map((day) => computeUsagePoint(rows, day))
