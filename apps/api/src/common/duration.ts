const UNIT_SECONDS = {
  ms: 0.001,
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
} as const

export const durationSeconds = (value: string | undefined, fallback: number) => {
  if (!value) return fallback
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim())
  if (!match) return fallback
  const amount = Number(match[1]) * UNIT_SECONDS[match[2] as keyof typeof UNIT_SECONDS]
  return Math.max(1, Math.ceil(amount))
}
