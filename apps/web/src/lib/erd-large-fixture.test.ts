import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { Position } from '@vue-flow/core'
import { erdToY, patchTable, yToErd } from '@erd-studio/yjs-erd'
import { buildLaneRoutes, type RoutedEdge } from './erd-edge-route'
import { generateLargeErd } from './erd-large-fixture'
import { applyErdStructuralPatch } from './erd-session-patch'

/** 60fps frame budget with CI headroom (ms). */
export const FRAME_BUDGET_MS = 16

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

const avgMs = (runs: number, fn: () => void) => {
  fn() // warm
  const t0 = performance.now()
  for (let i = 0; i < runs; i++) fn()
  return (performance.now() - t0) / runs
}

describe('large-schema canvas perf', () => {
  it('generates the 200×400 fixture', () => {
    const doc = generateLargeErd()
    expect(doc.tables).toHaveLength(200)
    expect(doc.relations.length).toBeGreaterThanOrEqual(400)
  })

  it('buildLaneRoutes averages under one frame for 400 edges', () => {
    const edges = toRouted(400)
    const ms = avgMs(30, () => {
      buildLaneRoutes(edges)
    })
    expect(ms).toBeLessThan(FRAME_BUDGET_MS)
    expect(buildLaneRoutes(edges).size).toBe(400)
  })

  it('yToErd for 200×400 stays under 2 frames on average', () => {
    const ydoc = new Y.Doc()
    erdToY(ydoc, generateLargeErd())
    const ms = avgMs(8, () => {
      yToErd(ydoc)
    })
    expect(ms).toBeLessThan(FRAME_BUDGET_MS * 2)
  })

  it('structural single-table patch on 200 tables stays under one frame', () => {
    const ydoc = new Y.Doc()
    const source = generateLargeErd()
    erdToY(ydoc, source)
    const prev = yToErd(ydoc)
    const targetId = prev.tables[0]!.id
    const events: Y.YEvent<any>[] = []
    const map = ydoc.getMap('tables')
    const handler = (batch: Y.YEvent<any>[]) => {
      events.push(...batch)
    }
    map.observeDeep(handler)
    patchTable(ydoc, targetId, { logicalName: 'perf-rename' })
    map.unobserveDeep(handler)

    const ms = avgMs(20, () => {
      applyErdStructuralPatch(ydoc, prev, events)
    })
    expect(ms).toBeLessThan(FRAME_BUDGET_MS)
    const next = applyErdStructuralPatch(ydoc, prev, events)
    expect(next?.tables.find((t) => t.id === targetId)?.logicalName).toBe(
      'perf-rename',
    )
    expect(next?.tables[1]).toBe(prev.tables[1])
  })
})
