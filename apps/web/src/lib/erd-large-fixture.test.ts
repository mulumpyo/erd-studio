import { describe, expect, it } from 'vitest'
import { Position } from '@vue-flow/core'
import { buildLaneRoutes, type RoutedEdge } from './erd-edge-route'
import { generateLargeErd } from './erd-large-fixture'

const toRouted = (count: number): RoutedEdge[] =>
  Array.from({ length: count }, (_, i) => {
    const left = i % 2 === 0
    return {
      id: `e${i}`,
      sourceX: left ? 100 : 500,
      sourceY: 40 + (i % 80) * 8,
      targetX: left ? 420 : 120,
      targetY: 60 + ((i * 3) % 80) * 8,
      sourcePosition: left ? Position.Right : Position.Left,
      targetPosition: left ? Position.Left : Position.Right,
    }
  })

describe('large-schema canvas perf', () => {
  it('generates the 200×400 fixture', () => {
    const doc = generateLargeErd()
    expect(doc.tables).toHaveLength(200)
    expect(doc.relations.length).toBeGreaterThanOrEqual(400)
  })

  it('buildLaneRoutes averages under one frame for 400 edges', () => {
    const edges = toRouted(400)
    // Warm JIT
    buildLaneRoutes(edges)
    const runs = 30
    const t0 = performance.now()
    for (let i = 0; i < runs; i++) buildLaneRoutes(edges)
    const avgMs = (performance.now() - t0) / runs
    // 60fps budget ≈ 16.7ms; leave headroom for CI variance.
    expect(avgMs).toBeLessThan(16)
    expect(buildLaneRoutes(edges).size).toBe(400)
  })
})
