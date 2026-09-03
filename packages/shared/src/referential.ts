export type ReferentialAction =
  | 'NO ACTION'
  | 'RESTRICT'
  | 'CASCADE'
  | 'SET NULL'
  | 'SET DEFAULT'

export const REFERENTIAL_ACTIONS: ReferentialAction[] = [
  'NO ACTION',
  'RESTRICT',
  'CASCADE',
  'SET NULL',
  'SET DEFAULT',
]

export const normalizeReferentialAction = (
  value: unknown,
): ReferentialAction | undefined => {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toUpperCase().replace(/\s+/g, ' ')
  return REFERENTIAL_ACTIONS.find((item) => item === normalized)
}
