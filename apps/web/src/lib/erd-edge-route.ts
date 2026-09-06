import { Position } from '@vue-flow/core'
import type { ErdTable } from '@erd-studio/shared'

const TABLE_WIDTH = 320
const TABLE_HEAD = 52
const COL_H = 38
const TABLE_FOOTER = 34
const LANE_GAP = 18
const STEP_OFFSET = 28
const STACK_BIAS = 48
const MID_BUCKET = 56
const SAME_X_BUCKET = 48

type HandleSide = 'left' | 'right'

export type NodeBox = {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export type NodeSize = { w: number; h: number }
export type NodeSizeMap = Map<string, NodeSize> | Record<string, NodeSize>

export type RoutedEdge = {
  id: string
  sourceX: number
  sourceY: number
  targetX: number
  targetY: number
  sourcePosition: Position
  targetPosition: Position
}

export type LaneRoute = {
  offset: number
  borderRadius: number
  centerX?: number
}

const intervalGap = (a0: number, a1: number, b0: number, b1: number) => {
  if (a1 < b0) return b0 - a1
  if (b1 < a0) return a0 - b1
  return 0
}

const lookupSize = (id: string, sizes?: NodeSizeMap): NodeSize | undefined => {
  if (!sizes) return undefined
  if (sizes instanceof Map) return sizes.get(id)
  return sizes[id]
}

export const tableBox = (
  table: ErdTable,
  sizes?: NodeSizeMap,
): Omit<NodeBox, 'id'> => {
  const measured = lookupSize(table.id, sizes)
  return {
    x: table.position.x,
    y: table.position.y,
    w: measured?.w ?? TABLE_WIDTH,
    h:
      measured?.h ??
      TABLE_HEAD + table.columns.length * COL_H + TABLE_FOOTER,
  }
}

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
  sizes?: NodeSizeMap,
): { source: HandleSide; target: HandleSide } => {
  if (source.id === target.id) return { source: 'right', target: 'right' }

  const a = tableBox(source, sizes)
  const b = tableBox(target, sizes)
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
  sizes?: NodeSizeMap,
) => {
  const sides =
    source && target
      ? pickSides(source, target, sourceColumnId, targetColumnId, sizes)
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

const defaultRoute = (): LaneRoute => ({
  offset: STEP_OFFSET,
  borderRadius: 10,
})

const sortByMidY = (a: RoutedEdge, b: RoutedEdge) => {
  const ay = (a.sourceY + a.targetY) / 2
  const by = (b.sourceY + b.targetY) / 2
  if (ay !== by) return ay - by
  return a.id.localeCompare(b.id)
}

const pushGroup = (
  groups: Map<string, RoutedEdge[]>,
  key: string,
  edge: RoutedEdge,
) => {
  const list = groups.get(key)
  if (list) list.push(edge)
  else groups.set(key, [edge])
}

/**
 * Build lane offsets once per frame.
 * Corridor bucketing is O(E); per-corridor sort is O(E log E) total; assign is O(E).
 */
export const buildLaneRoutes = (
  edges: RoutedEdge[],
): Map<string, LaneRoute> => {
  const result = new Map<string, LaneRoute>()
  const opposite = new Map<string, RoutedEdge[]>()
  const same = new Map<string, RoutedEdge[]>()

  for (const edge of edges) {
    if (isOppositeHorizontal(edge)) {
      const midX = (edge.sourceX + edge.targetX) / 2
      pushGroup(opposite, `opp:${Math.round(midX / MID_BUCKET)}`, edge)
      continue
    }
    if (isSameHorizontal(edge)) {
      const side = edge.sourcePosition
      const anchorX =
        side === Position.Right
          ? Math.max(edge.sourceX, edge.targetX)
          : Math.min(edge.sourceX, edge.targetX)
      pushGroup(
        same,
        `same:${side}:${Math.round(anchorX / SAME_X_BUCKET)}`,
        edge,
      )
      continue
    }
    result.set(edge.id, defaultRoute())
  }

  for (const group of opposite.values()) {
    group.sort(sortByMidY)
    const n = group.length
    for (let i = 0; i < n; i += 1) {
      const edge = group[i]!
      const midX = (edge.sourceX + edge.targetX) / 2
      result.set(edge.id, {
        offset: STEP_OFFSET,
        borderRadius: 10,
        centerX: midX + (i - (n - 1) / 2) * LANE_GAP,
      })
    }
  }

  for (const group of same.values()) {
    group.sort(sortByMidY)
    for (let i = 0; i < group.length; i += 1) {
      result.set(group[i]!.id, {
        offset: STEP_OFFSET + i * LANE_GAP,
        borderRadius: 10,
      })
    }
  }

  return result
}

/** Solo / test helper — prefer `buildLaneRoutes` once per frame in the canvas. */
export const smoothStepRoute = (
  edge: RoutedEdge,
  all: RoutedEdge[] = [edge],
): LaneRoute =>
  buildLaneRoutes(all).get(edge.id) ?? defaultRoute()
