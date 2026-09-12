import { describe, expect, it } from 'vitest'
import { Position } from '@vue-flow/core'
import {
  buildLaneRoutes,
  routeAvoidingObstacles,
  verticalLaneHitsBox,
  type NodeBox,
  type RoutedEdge,
} from '@/lib/erd-edge-route'

const edge = (
  id: string,
  partial: Partial<RoutedEdge> &
    Pick<RoutedEdge, 'sourceX' | 'sourceY' | 'targetX' | 'targetY'>,
): RoutedEdge => ({
  id,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  ...partial,
})

describe('buildLaneRoutes', () => {
  it('offsets opposite-direction edges that share a corridor', () => {
    const edges = [
      edge('a', { sourceX: 0, sourceY: 10, targetX: 200, targetY: 120 }),
      edge('b', { sourceX: 0, sourceY: 40, targetX: 200, targetY: 150 }),
      edge('c', { sourceX: 0, sourceY: 70, targetX: 200, targetY: 180 }),
    ]
    const routes = buildLaneRoutes(edges)
    const centers = ['a', 'b', 'c'].map((id) => routes.get(id)?.centerX)
    expect(centers.every((value) => typeof value === 'number')).toBe(true)
    expect(new Set(centers.map((x) => Math.round(x!))).size).toBe(3)
  })

  it('stacks same-side edges with increasing offsets', () => {
    const edges = [
      edge('a', {
        sourceX: 100,
        sourceY: 10,
        targetX: 100,
        targetY: 80,
        sourcePosition: Position.Right,
        targetPosition: Position.Right,
      }),
      edge('b', {
        sourceX: 100,
        sourceY: 30,
        targetX: 100,
        targetY: 110,
        sourcePosition: Position.Right,
        targetPosition: Position.Right,
      }),
    ]
    const routes = buildLaneRoutes(edges)
    expect(routes.get('a')?.offset).toBeLessThan(routes.get('b')!.offset)
  })

  it('returns a default route for non-horizontal edges', () => {
    const routes = buildLaneRoutes([
      edge('diag', {
        sourceX: 0,
        sourceY: 0,
        targetX: 40,
        targetY: 80,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      }),
    ])
    expect(routes.get('diag')).toEqual({ offset: 28, borderRadius: 10 })
  })

  it('routes around a blocking table instead of through it', () => {
    const blocker: NodeBox = {
      id: 'mid',
      x: 200,
      y: 0,
      w: 160,
      h: 200,
    }
    const link = edge('rel', {
      sourceX: 100,
      sourceY: 80,
      targetX: 500,
      targetY: 80,
      sourceId: 'left',
      targetId: 'right',
    })
    // 중간점 300은 장애물 [200,360] 안에 있어요.
    expect(verticalLaneHitsBox(300, 80, 80, blocker)).toBe(true)

    const route = routeAvoidingObstacles(link, [blocker])
    expect(route.path).toBeTruthy()
    // 몸통을 가로지르는 직선 H-V-H는 거절하고, 우회는 Y 띠를 벗어나요.
    if (route.centerX != null) {
      expect(verticalLaneHitsBox(route.centerX, 80, 80, blocker)).toBe(false)
    } else {
      expect(
        route.labelY < blocker.y - 8 ||
          route.labelY > blocker.y + blocker.h + 8,
      ).toBe(true)
    }

    const routes = buildLaneRoutes([link], [blocker])
    const built = routes.get('rel')
    expect(built?.path).toBeTruthy()
    expect(built?.centerX == null || built.centerX < 200 || built.centerX > 360).toBe(
      true,
    )
  })

  it('keeps a clear mid corridor when nothing blocks it', () => {
    const side: NodeBox = {
      id: 'aside',
      x: 200,
      y: 300,
      w: 160,
      h: 120,
    }
    const link = edge('rel', {
      sourceX: 100,
      sourceY: 40,
      targetX: 500,
      targetY: 40,
      sourceId: 'a',
      targetId: 'b',
    })
    const route = routeAvoidingObstacles(link, [side])
    expect(route.labelX).toBeCloseTo(300, 0)
  })

  it('separates overlapping opposite edges onto distinct vertical lanes', () => {
    const edges = [
      edge('a', {
        sourceX: 0,
        sourceY: 20,
        targetX: 400,
        targetY: 180,
        sourceId: 's1',
        targetId: 't1',
      }),
      edge('b', {
        sourceX: 10,
        sourceY: 40,
        targetX: 390,
        targetY: 200,
        sourceId: 's2',
        targetId: 't2',
      }),
      edge('c', {
        sourceX: 5,
        sourceY: 60,
        targetX: 395,
        targetY: 220,
        sourceId: 's3',
        targetId: 't3',
      }),
    ]
    const routes = buildLaneRoutes(edges)
    const centers = ['a', 'b', 'c'].map((id) => routes.get(id)?.centerX ?? 0)
    expect(new Set(centers.map((x) => Math.round(x))).size).toBe(3)
    // Y가 겹치는 쌍은 적어도 LANE_GAP만큼 떨어져야 해요.
    for (let i = 0; i < centers.length; i += 1) {
      for (let j = i + 1; j < centers.length; j += 1) {
        expect(Math.abs(centers[i]! - centers[j]!)).toBeGreaterThanOrEqual(24)
      }
    }
  })

  it('keeps distinct vertical lanes even when Y ranges do not overlap', () => {
    // 예전에 Y가 안 겹치면 같은 mid X를 공유해 중간에 한 줄로 붙었어요.
    const edges = [
      edge('top', {
        sourceX: 0,
        sourceY: 20,
        targetX: 400,
        targetY: 40,
        sourceId: 'a',
        targetId: 'b',
      }),
      edge('mid', {
        sourceX: 0,
        sourceY: 200,
        targetX: 400,
        targetY: 220,
        sourceId: 'c',
        targetId: 'd',
      }),
      edge('bot', {
        sourceX: 0,
        sourceY: 400,
        targetX: 400,
        targetY: 420,
        sourceId: 'e',
        targetId: 'f',
      }),
    ]
    const routes = buildLaneRoutes(edges)
    const centers = ['top', 'mid', 'bot'].map(
      (id) => routes.get(id)?.centerX ?? 0,
    )
    expect(new Set(centers.map((x) => Math.round(x))).size).toBe(3)
    for (let i = 0; i < centers.length; i += 1) {
      for (let j = i + 1; j < centers.length; j += 1) {
        expect(Math.abs(centers[i]! - centers[j]!)).toBeGreaterThanOrEqual(24)
      }
    }
  })
})
