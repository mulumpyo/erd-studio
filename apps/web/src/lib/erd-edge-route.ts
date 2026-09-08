import { Position } from '@vue-flow/core'
import type { ErdTable } from '@erd-studio/shared'

const TABLE_WIDTH = 320
const TABLE_HEAD = 52
const COL_H = 38
const TABLE_FOOTER = 34
const LANE_GAP = 20
const STEP_OFFSET = 28
const STACK_BIAS = 48
const SAME_X_BUCKET = 48
const OBSTACLE_PAD = 14
const CLEAR_MARGIN = 48
const STUB = 24
const MAX_LANE_TRIES = 28

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
  /** Table / node ids — used to skip self when avoiding obstacles. */
  sourceId?: string
  targetId?: string
}

export type LaneRoute = {
  offset: number
  borderRadius: number
  centerX?: number
  /** Custom orthogonal SVG path (obstacle-aware). */
  path?: string
  labelX?: number
  labelY?: number
}

type RouteCandidate = {
  cost: number
  offset: number
  borderRadius: number
  centerX?: number
  path?: string
  labelX: number
  labelY: number
}

type EdgeExtras = RoutedEdge & {
  __sameLane?: number
}

type VerticalLaneUse = { x: number; y0: number; y1: number }
type HorizontalLaneUse = { y: number; x0: number; x1: number }

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

const overlapsY = (box: NodeBox, y0: number, y1: number, pad: number) => {
  const top = Math.min(y0, y1)
  const bot = Math.max(y0, y1)
  return !(bot < box.y - pad || top > box.y + box.h + pad)
}

/** Vertical lane at x crosses a table body between y0..y1. */
export const verticalLaneHitsBox = (
  laneX: number,
  y0: number,
  y1: number,
  box: NodeBox,
  pad = OBSTACLE_PAD,
) => {
  if (!overlapsY(box, y0, y1, pad)) return false
  return laneX >= box.x - pad && laneX <= box.x + box.w + pad
}

/** Horizontal segment at y crosses a table body between x0..x1. */
export const horizontalSegHitsBox = (
  x0: number,
  x1: number,
  y: number,
  box: NodeBox,
  pad = OBSTACLE_PAD,
) => {
  if (y < box.y - pad || y > box.y + box.h + pad) return false
  const lo = Math.min(x0, x1)
  const hi = Math.max(x0, x1)
  return lo < box.x + box.w - 4 && hi > box.x + 4
}

const laneClear = (
  laneX: number,
  y0: number,
  y1: number,
  boxes: NodeBox[],
  pad = OBSTACLE_PAD,
) => !boxes.some((box) => verticalLaneHitsBox(laneX, y0, y1, box, pad))

const hClear = (
  x0: number,
  x1: number,
  y: number,
  boxes: NodeBox[],
  pad = OBSTACLE_PAD,
) => !boxes.some((box) => horizontalSegHitsBox(x0, x1, y, box, pad))

const boxesForEdge = (edge: RoutedEdge, boxes: NodeBox[]) => {
  const skip = new Set(
    [edge.sourceId, edge.targetId].filter(Boolean) as string[],
  )
  const y0 = edge.sourceY
  const y1 = edge.targetY
  return boxes.filter(
    (box) => !skip.has(box.id) && overlapsY(box, y0, y1, OBSTACLE_PAD + 8),
  )
}

const orthoPath = (
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  laneX: number,
) => `M ${sx} ${sy} H ${laneX} V ${ty} H ${tx}`

/** Exit stubs then route above/below obstacles so horizontals never cross table bodies. */
const detourPath = (
  edge: RoutedEdge,
  detourY: number,
): { path: string; labelX: number; labelY: number } => {
  const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty } = edge
  const sExit =
    edge.sourcePosition === Position.Right
      ? sx + STUB
      : edge.sourcePosition === Position.Left
        ? sx - STUB
        : sx
  const tExit =
    edge.targetPosition === Position.Right
      ? tx + STUB
      : edge.targetPosition === Position.Left
        ? tx - STUB
        : tx
  return {
    path: `M ${sx} ${sy} H ${sExit} V ${detourY} H ${tExit} V ${ty} H ${tx}`,
    labelX: (sExit + tExit) / 2,
    labelY: detourY,
  }
}

const candidateForLane = (
  edge: RoutedEdge,
  laneX: number,
  boxes: NodeBox[],
  baseCost: number,
): RouteCandidate | null => {
  const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty } = edge
  if (!laneClear(laneX, sy, ty, boxes)) return null
  if (!hClear(sx, laneX, sy, boxes)) return null
  if (!hClear(laneX, tx, ty, boxes)) return null
  const midIdeal = (sx + tx) / 2
  const length = Math.abs(laneX - sx) + Math.abs(ty - sy) + Math.abs(tx - laneX)
  return {
    cost: baseCost + length * 0.02 + Math.abs(laneX - midIdeal) * 0.15,
    offset: STEP_OFFSET,
    borderRadius: 10,
    centerX: laneX,
    path: orthoPath(sx, sy, tx, ty, laneX),
    labelX: laneX,
    labelY: (sy + ty) / 2,
  }
}

const candidateForDetour = (
  edge: RoutedEdge,
  detourY: number,
  boxes: NodeBox[],
  baseCost: number,
): RouteCandidate | null => {
  const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty } = edge
  const sExit =
    edge.sourcePosition === Position.Right
      ? sx + STUB
      : edge.sourcePosition === Position.Left
        ? sx - STUB
        : sx
  const tExit =
    edge.targetPosition === Position.Right
      ? tx + STUB
      : edge.targetPosition === Position.Left
        ? tx - STUB
        : tx
  // Stubs stay local; long horizontal must clear every obstacle at detourY.
  if (!hClear(sx, sExit, sy, boxes)) return null
  if (!hClear(tExit, tx, ty, boxes)) return null
  if (!laneClear(sExit, sy, detourY, boxes)) return null
  if (!laneClear(tExit, detourY, ty, boxes)) return null
  if (!hClear(sExit, tExit, detourY, boxes)) return null
  const drawn = detourPath(edge, detourY)
  const length =
    Math.abs(sExit - sx) +
    Math.abs(detourY - sy) +
    Math.abs(tExit - sExit) +
    Math.abs(ty - detourY) +
    Math.abs(tx - tExit)
  return {
    cost: baseCost + length * 0.02,
    offset: STEP_OFFSET,
    borderRadius: 10,
    path: drawn.path,
    labelX: drawn.labelX,
    labelY: drawn.labelY,
  }
}

const collectLaneXs = (edge: RoutedEdge, boxes: NodeBox[]): number[] => {
  const { sourceX: sx, targetX: tx } = edge
  const xs = new Set<number>()
  xs.add((sx + tx) / 2)
  xs.add(sx + (edge.sourcePosition === Position.Right ? STUB : -STUB))
  xs.add(tx + (edge.targetPosition === Position.Right ? STUB : -STUB))

  let minL = Math.min(sx, tx)
  let maxR = Math.max(sx, tx)
  for (const box of boxes) {
    minL = Math.min(minL, box.x)
    maxR = Math.max(maxR, box.x + box.w)
    xs.add(box.x - OBSTACLE_PAD - 8)
    xs.add(box.x + box.w + OBSTACLE_PAD + 8)
  }
  xs.add(minL - CLEAR_MARGIN)
  xs.add(maxR + CLEAR_MARGIN)

  const edges = boxes
    .flatMap((box) => [box.x - OBSTACLE_PAD, box.x + box.w + OBSTACLE_PAD])
    .sort((a, b) => a - b)
  for (let i = 0; i < edges.length - 1; i += 1) {
    const a = edges[i]!
    const b = edges[i + 1]!
    if (b - a > LANE_GAP * 2) xs.add((a + b) / 2)
  }

  return [...xs]
}

/**
 * Pick an orthogonal corridor that does not run through other tables.
 * Prefers a short mid lane; falls back to above/below detours.
 */
export const routeAvoidingObstacles = (
  edge: RoutedEdge,
  boxes: NodeBox[],
): RouteCandidate => {
  const obstacles = boxesForEdge(edge, boxes)
  const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty } = edge
  const labelY = (sy + ty) / 2
  const mid = (sx + tx) / 2
  const fallback: RouteCandidate = {
    cost: 1e9,
    offset: STEP_OFFSET,
    borderRadius: 10,
    centerX: mid,
    path: orthoPath(sx, sy, tx, ty, mid),
    labelX: mid,
    labelY,
  }

  if (!obstacles.length) {
    return {
      cost: 0,
      offset: STEP_OFFSET,
      borderRadius: 10,
      centerX: mid,
      path: orthoPath(sx, sy, tx, ty, mid),
      labelX: mid,
      labelY,
    }
  }

  const candidates: RouteCandidate[] = []
  for (const laneX of collectLaneXs(edge, obstacles)) {
    const hit = candidateForLane(edge, laneX, obstacles, 0)
    if (hit) candidates.push(hit)
  }

  let clearTop = Math.min(sy, ty) - CLEAR_MARGIN
  let clearBottom = Math.max(sy, ty) + CLEAR_MARGIN
  for (const box of obstacles) {
    clearTop = Math.min(clearTop, box.y - CLEAR_MARGIN)
    clearBottom = Math.max(clearBottom, box.y + box.h + CLEAR_MARGIN)
  }
  const above = candidateForDetour(edge, clearTop, obstacles, 400)
  if (above) candidates.push(above)
  const below = candidateForDetour(edge, clearBottom, obstacles, 420)
  if (below) candidates.push(below)

  if (!candidates.length) return fallback
  candidates.sort((a, b) => a.cost - b.cost || a.labelX - b.labelX)
  return candidates[0]!
}

const rangesOverlap = (a0: number, a1: number, b0: number, b1: number) => {
  const aLo = Math.min(a0, a1)
  const aHi = Math.max(a0, a1)
  const bLo = Math.min(b0, b1)
  const bHi = Math.max(b0, b1)
  return !(aHi < bLo || bHi < aLo)
}

const conflictsVerticalLane = (
  x: number,
  y0: number,
  y1: number,
  used: VerticalLaneUse[],
) =>
  used.some(
    (lane) =>
      Math.abs(lane.x - x) < LANE_GAP &&
      rangesOverlap(y0, y1, lane.y0, lane.y1),
  )

const conflictsHorizontalLane = (
  y: number,
  x0: number,
  x1: number,
  used: HorizontalLaneUse[],
) =>
  used.some(
    (lane) =>
      Math.abs(lane.y - y) < LANE_GAP &&
      rangesOverlap(x0, x1, lane.x0, lane.x1),
  )

const stubX = (edge: RoutedEdge, which: 'source' | 'target') => {
  const x = which === 'source' ? edge.sourceX : edge.targetX
  const pos = which === 'source' ? edge.sourcePosition : edge.targetPosition
  if (pos === Position.Right) return x + STUB
  if (pos === Position.Left) return x - STUB
  return x
}

const laneSearchOffsets = () => {
  const offsets = [0]
  for (let step = 1; step <= MAX_LANE_TRIES; step += 1) {
    offsets.push(step * LANE_GAP, -step * LANE_GAP)
  }
  return offsets
}

const toLaneRoute = (candidate: RouteCandidate): LaneRoute => ({
  offset: candidate.offset,
  borderRadius: candidate.borderRadius,
  centerX: candidate.centerX,
  path: candidate.path,
  labelX: candidate.labelX,
  labelY: candidate.labelY,
})

const preferWithoutObstacles = (edge: RoutedEdge): RouteCandidate => {
  const mid = (edge.sourceX + edge.targetX) / 2
  return {
    cost: 0,
    offset: STEP_OFFSET,
    borderRadius: 10,
    centerX: mid,
    path: orthoPath(
      edge.sourceX,
      edge.sourceY,
      edge.targetX,
      edge.targetY,
      mid,
    ),
    labelX: mid,
    labelY: (edge.sourceY + edge.targetY) / 2,
  }
}

/** Separate opposite-direction edges so vertical/detour corridors do not share a lane. */
const assignOppositeRoutes = (
  edges: RoutedEdge[],
  boxes: NodeBox[],
): Map<string, LaneRoute> => {
  const result = new Map<string, LaneRoute>()
  if (!edges.length) return result

  const prepared = edges.map((edge) => ({
    edge,
    pref: boxes.length
      ? routeAvoidingObstacles(edge, boxes)
      : preferWithoutObstacles(edge),
  }))

  const vertical = prepared
    .filter((item) => item.pref.centerX != null)
    .sort((a, b) => sortByMidY(a.edge, b.edge))
  const detours = prepared
    .filter((item) => item.pref.centerX == null)
    .sort(
      (a, b) =>
        a.pref.labelY - b.pref.labelY || sortByMidY(a.edge, b.edge),
    )

  const usedV: VerticalLaneUse[] = []
  const usedH: HorizontalLaneUse[] = []
  const offsets = laneSearchOffsets()

  for (const { edge, pref } of vertical) {
    const obstacles = boxesForEdge(edge, boxes)
    const y0 = edge.sourceY
    const y1 = edge.targetY
    const base = pref.centerX ?? pref.labelX
    let chosen: RouteCandidate | null = null

    for (const delta of offsets) {
      const x = base + delta
      if (conflictsVerticalLane(x, y0, y1, usedV)) continue
      const hit = candidateForLane(edge, x, obstacles, Math.abs(delta))
      if (!hit) continue
      // Horizontal legs should also stay off other edges' horizontals.
      if (conflictsHorizontalLane(y0, edge.sourceX, x, usedH)) continue
      if (conflictsHorizontalLane(y1, x, edge.targetX, usedH)) continue
      chosen = hit
      break
    }

    if (!chosen) {
      for (const delta of offsets) {
        const x = base + delta
        if (conflictsVerticalLane(x, y0, y1, usedV)) continue
        chosen = {
          cost: Math.abs(delta),
          offset: STEP_OFFSET,
          borderRadius: 10,
          centerX: x,
          path: orthoPath(
            edge.sourceX,
            edge.sourceY,
            edge.targetX,
            edge.targetY,
            x,
          ),
          labelX: x,
          labelY: (y0 + y1) / 2,
        }
        break
      }
    }

    const route = toLaneRoute(chosen ?? pref)
    const laneX = route.centerX ?? route.labelX ?? base
    result.set(edge.id, route)
    usedV.push({ x: laneX, y0, y1 })
    usedH.push({ y: y0, x0: edge.sourceX, x1: laneX })
    usedH.push({ y: y1, x0: laneX, x1: edge.targetX })
  }

  for (const { edge, pref } of detours) {
    const obstacles = boxesForEdge(edge, boxes)
    const sExit = stubX(edge, 'source')
    const tExit = stubX(edge, 'target')
    const x0 = Math.min(sExit, tExit)
    const x1 = Math.max(sExit, tExit)
    let chosen: RouteCandidate | null = null

    for (const delta of offsets) {
      const y = pref.labelY + delta
      if (conflictsHorizontalLane(y, x0, x1, usedH)) continue
      if (conflictsVerticalLane(sExit, edge.sourceY, y, usedV)) continue
      if (conflictsVerticalLane(tExit, y, edge.targetY, usedV)) continue
      const hit = candidateForDetour(edge, y, obstacles, Math.abs(delta))
      if (!hit) continue
      chosen = hit
      break
    }

    const route = toLaneRoute(chosen ?? pref)
    result.set(edge.id, route)
    usedH.push({ y: route.labelY, x0, x1 })
    usedV.push({ x: sExit, y0: edge.sourceY, y1: route.labelY })
    usedV.push({ x: tExit, y0: route.labelY, y1: edge.targetY })
  }

  return result
}

/**
 * Build lane offsets once per frame.
 * When `boxes` is provided, corridors avoid tables; all edges also separate from each other.
 */
export const buildLaneRoutes = (
  edges: RoutedEdge[],
  boxes: NodeBox[] = [],
): Map<string, LaneRoute> => {
  const result = new Map<string, LaneRoute>()
  const opposite: RoutedEdge[] = []
  const same = new Map<string, RoutedEdge[]>()

  for (const edge of edges) {
    const extras = edge as EdgeExtras
    if (isOppositeHorizontal(edge)) {
      opposite.push(edge)
      continue
    }
    if (isSameHorizontal(edge)) {
      const side = edge.sourcePosition
      const anchorX =
        side === Position.Right
          ? Math.max(edge.sourceX, edge.targetX)
          : Math.min(edge.sourceX, edge.targetX)
      let lane = anchorX + (side === Position.Right ? STEP_OFFSET : -STEP_OFFSET)
      if (boxes.length) {
        const obstacles = boxesForEdge(edge, boxes)
        if (side === Position.Right) {
          for (const box of obstacles) {
            lane = Math.max(lane, box.x + box.w + CLEAR_MARGIN)
          }
        } else {
          for (const box of obstacles) {
            lane = Math.min(lane, box.x - CLEAR_MARGIN)
          }
        }
        extras.__sameLane = lane
      }
      pushGroup(
        same,
        `same:${side}:${Math.round((boxes.length ? lane : anchorX) / SAME_X_BUCKET)}`,
        edge,
      )
      continue
    }
    result.set(edge.id, defaultRoute())
  }

  for (const [id, route] of assignOppositeRoutes(opposite, boxes)) {
    result.set(id, route)
  }

  // Same-side edges: stack outer lanes, then nudge if another edge already owns that X.
  const usedSameV: VerticalLaneUse[] = []
  for (const group of same.values()) {
    group.sort(sortByMidY)
    for (let i = 0; i < group.length; i += 1) {
      const edge = group[i]!
      const extras = edge as EdgeExtras
      const base =
        extras.__sameLane ??
        (edge.sourcePosition === Position.Right
          ? Math.max(edge.sourceX, edge.targetX) + STEP_OFFSET
          : Math.min(edge.sourceX, edge.targetX) - STEP_OFFSET)
      const dir = edge.sourcePosition === Position.Right ? 1 : -1
      let laneX = base + dir * i * LANE_GAP
      for (let t = 0; t < MAX_LANE_TRIES; t += 1) {
        const trial = laneX + dir * t * LANE_GAP
        if (
          !conflictsVerticalLane(
            trial,
            edge.sourceY,
            edge.targetY,
            usedSameV,
          )
        ) {
          laneX = trial
          break
        }
      }
      result.set(edge.id, {
        offset: STEP_OFFSET + Math.abs(laneX - base),
        borderRadius: 10,
        centerX: laneX,
        path: orthoPath(
          edge.sourceX,
          edge.sourceY,
          edge.targetX,
          edge.targetY,
          laneX,
        ),
        labelX: laneX,
        labelY: (edge.sourceY + edge.targetY) / 2,
      })
      usedSameV.push({
        x: laneX,
        y0: edge.sourceY,
        y1: edge.targetY,
      })
      delete extras.__sameLane
    }
  }

  return result
}

/** Solo / test helper — prefer `buildLaneRoutes` once per frame in the canvas. */
export const smoothStepRoute = (
  edge: RoutedEdge,
  all: RoutedEdge[] = [edge],
  boxes: NodeBox[] = [],
): LaneRoute =>
  buildLaneRoutes(all, boxes).get(edge.id) ?? defaultRoute()
