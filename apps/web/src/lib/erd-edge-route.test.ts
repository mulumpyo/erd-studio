import { describe, expect, it } from 'vitest'
import { Position } from '@vue-flow/core'
import { buildLaneRoutes, type RoutedEdge } from '@/lib/erd-edge-route'

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
      edge('a', { sourceX: 0, sourceY: 10, targetX: 200, targetY: 10 }),
      edge('b', { sourceX: 0, sourceY: 40, targetX: 200, targetY: 40 }),
      edge('c', { sourceX: 0, sourceY: 70, targetX: 200, targetY: 70 }),
    ]
    const routes = buildLaneRoutes(edges)
    const centers = ['a', 'b', 'c'].map((id) => routes.get(id)?.centerX)
    expect(centers.every((value) => typeof value === 'number')).toBe(true)
    expect(new Set(centers).size).toBe(3)
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
})
