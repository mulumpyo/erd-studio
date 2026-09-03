import type { NameMode } from '@erd-studio/shared'

export type { NameMode }

export const nameModeLabel = (mode: NameMode) => {
  if (mode === 'logical') return '논리명'
  if (mode === 'physical') return '물리명'
  return '논리/물리'
}
