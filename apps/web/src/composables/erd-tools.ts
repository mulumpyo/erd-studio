import type { Cardinality, RelationKind } from '@erd-studio/shared'

export type Tool =
  | 'select'
  | 'table'
  | 'note'
  | 'identifying'
  | 'non-identifying'
  | 'one-to-one'
  | 'many-to-many'

export const relationFromTool = (tool: Tool) => {
  if (tool === 'identifying')
    return {
      kind: 'identifying' as const,
      sourceCardinality: '1' as const,
      targetCardinality: 'N' as const,
    }
  if (tool === 'non-identifying')
    return {
      kind: 'non-identifying' as const,
      sourceCardinality: '1' as const,
      targetCardinality: 'N' as const,
    }
  if (tool === 'one-to-one')
    return {
      kind: 'non-identifying' as const,
      sourceCardinality: '1' as const,
      targetCardinality: '1' as const,
    }
  return null
}

export const defaultRelation = (): {
  kind: RelationKind
  sourceCardinality: Cardinality
  targetCardinality: Cardinality
} => ({
  kind: 'non-identifying',
  sourceCardinality: '1',
  targetCardinality: 'N',
})

export const columnIdFromHandle = (handle?: string | null) =>
  handle?.replace(/-right$|-left$/, '')

export const isRelationTool = (tool: Tool) =>
  tool === 'identifying' ||
  tool === 'non-identifying' ||
  tool === 'one-to-one' ||
  tool === 'many-to-many'

export const toolGuide = (tool: Tool, pendingSource = false) => {
  if (tool === 'table') return '빈 캔버스를 클릭하면 테이블이 생겨요'
  if (tool === 'note') return '빈 캔버스를 클릭하면 메모가 생겨요'
  if (tool === 'identifying') {
    return pendingSource
      ? '이제 자식 테이블(N)을 클릭하세요. Esc로 취소할 수 있어요'
      : '식별 1:N — 부모 테이블(1)을 먼저 클릭하세요'
  }
  if (tool === 'non-identifying') {
    return pendingSource
      ? '이제 자식 테이블(N)을 클릭하세요. Esc로 취소할 수 있어요'
      : '비식별 1:N — 부모 테이블(1)을 먼저 클릭하세요'
  }
  if (tool === 'one-to-one') {
    return pendingSource
      ? '연결할 다른 테이블을 클릭하세요. Esc로 취소할 수 있어요'
      : '1:1 — 첫 번째 테이블을 클릭하세요'
  }
  if (tool === 'many-to-many') {
    return pendingSource
      ? '연결할 다른 테이블을 클릭하세요. Esc로 취소할 수 있어요'
      : 'N:M — 첫 번째 테이블을 클릭하세요. 중간 테이블이 자동으로 생겨요'
  }
  return ''
}
