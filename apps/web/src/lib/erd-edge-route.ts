import { Position } from '@vue-flow/core'
import type { ErdTable } from '@erd-studio/shared'

const TABLE_WIDTH = 320
const TABLE_HEAD = 52
const COL_H = 38
const TABLE_FOOTER = 34
const LANE_GAP = 18
const STEP_OFFSET = 28
const STACK_BIAS = 48

type HandleSide = 'left' | 'right'

export type RoutedEdge = {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
}

const intervalGap = (a0: number, a1: number, b0: number, b1: number) => {
  if (a1 < b0) return b0 - a1
  if (b1 < a0) return a0 - b1
  return 0
}

const tableBox = (table: ErdTable) => ({
  x: table.position.x,
  y: table.position.y,
  w: TABLE_WIDTH,
  h: TABLE_HEAD + table.columns.length * COL_H + TABLE_FOOTER,
})

const colCenterY = (table: ErdTable, columnId?: string) => {
  const index = Math.max(
    0,
    columnId ? table.columns.findIndex((col) => col.id === columnId) : 0,
  )
  return table.position.y + TABLE_HEAD + index * COL_H + COL_H / 2
}

const sideX = (box: { x: number; w: number }, side: HandleSide) =>
  side === 'right' ? box.x + box.w : box.x

const manhattan = (x1: number, y1: number, x2: number, y2: number) =>
  Math.abs(x2 - x1) + Math.abs(y2 - y1)

const pickSides = (
  source: ErdTable,
  target: ErdTable,
  sourceColumnId?: string,
  targetColumnId?: string,
): { source: HandleSide; target: HandleSide } => {
  if (source.id === target.id) return { source: 'right', target: 'right' }

  const a = tableBox(source)
  const b = tableBox(target)
  const gx = intervalGap(a.x, a.x + a.w, b.x, b.x + b.w)
  const gy = intervalGap(a.y, a.y + a.h, b.y, b.y + b.h)

  if (gy > gx + STACK_BIAS) {
    const sy = colCenterY(source, sourceColumnId)
    const ty = colCenterY(target, targetColumnId)
    const left = manhattan(sideX(a, 'left'), sy, sideX(b, 'left'), ty)
    const right = manhattan(sideX(a, 'right'), sy, sideX(b, 'right'), ty)
    const side: HandleSide = left < right ? 'left' : 'right'
    return { source: side, target: side }
  }

  if (a.x + a.w / 2 <= b.x + b.w / 2) {
    return { source: 'right', target: 'left' }
  }
  return { source: 'left', target: 'right' }
}

export const relationHandles = (
  source: ErdTable | undefined,
  target: ErdTable | undefined,
  sourceColumnId?: string,
  targetColumnId?: string,
) => {
  const sides =
    source && target
      ? pickSides(source, target, sourceColumnId, targetColumnId)
      : { source: 'right' as const, target: 'left' as const }
  return {
    sourceHandle: sourceColumnId
      ? `${sourceColumnId}-${sides.source}`
      : undefined,
    targetHandle: targetColumnId
      ? `${targetColumnId}-${sides.target}`
      : undefined,
  }
}

const isOppositeHorizontal = (edge: RoutedEdge) =>
  (edge.sourcePosition === Position.Right &&
    edge.targetPosition === Position.Left) ||
  (edge.sourcePosition === Position.Left &&
    edge.targetPosition === Position.Right)

const isSameHorizontal = (edge: RoutedEdge) =>
  (edge.sourcePosition === Position.Right &&
    edge.targetPosition === Position.Right) ||
  (edge.sourcePosition === Position.Left &&
    edge.targetPosition === Position.Left)

const yOverlaps = (a: RoutedEdge, b: RoutedEdge, pad = 12) => {
  const a1 = Math.min(a.sourceY, a.targetY) - pad
  const a2 = Math.max(a.sourceY, a.targetY) + pad
  const b1 = Math.min(b.sourceY, b.targetY)
  const b2 = Math.max(b.sourceY, b.targetY)
  return b1 <= a2 && b2 >= a1
}

const laneIndex = (edge: RoutedEdge, group: RoutedEdge[]) => {
  const sorted = [...group].sort((a, b) => {
    const ay = (a.sourceY + a.targetY) / 2
    const by = (b.sourceY + b.targetY) / 2
    if (ay !== by) return ay - by
    return a.id.localeCompare(b.id)
  })
  const i = sorted.findIndex((item) => item.id === edge.id)
  return { i: Math.max(0, i), n: sorted.length }
}

export const smoothStepRoute = (edge: RoutedEdge, all: RoutedEdge[]) => {
  if (isOppositeHorizontal(edge)) {
    const midX = (edge.sourceX + edge.targetX) / 2
    const group = all.filter((other) => {
      if (!isOppositeHorizontal(other)) return false
      const otherMid = (other.sourceX + other.targetX) / 2
      if (Math.abs(otherMid - midX) > 56) return false
      return yOverlaps(edge, other)
    })
    const { i, n } = laneIndex(edge, group)
    return {
      offset: STEP_OFFSET,
      borderRadius: 10,
      centerX: midX + (i - (n - 1) / 2) * LANE_GAP,
    }
  }

  if (isSameHorizontal(edge)) {
    const group = all.filter((other) => {
      if (
        other.sourcePosition !== edge.sourcePosition ||
        other.targetPosition !== edge.targetPosition
      ) {
        return false
      }
      const closeX =
        Math.abs(other.sourceX - edge.sourceX) < 48 ||
        Math.abs(other.targetX - edge.targetX) < 48
      return closeX && yOverlaps(edge, other)
    })
    const { i } = laneIndex(edge, group)
    return {
      offset: STEP_OFFSET + i * LANE_GAP,
      borderRadius: 10,
    }
  }

  return { offset: STEP_OFFSET, borderRadius: 10 }
}
