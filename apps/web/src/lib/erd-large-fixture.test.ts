import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { Position } from '@vue-flow/core'
import { erdToY, patchTable, yToErd } from '@erd-studio/yjs-erd'
import {
  buildLaneRoutes,
  tableBox,
  type RoutedEdge,
} from './erd-edge-route'
import { generateLargeErd } from './erd-large-fixture'
import { applyErdStructuralPatch } from './erd-session-patch'

/** 60fps 한 프레임 예산(ms). */
export const FRAME_BUDGET_MS = 16

/**
 * GitHub Actions 공유 러너는 로컬보다 몇 배 느려요.
 * 회귀만 잡도록 CI에서는 예산을 넉넉히 잡아요.
 */
const PERF_SLACK =
  process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true' ? 3 : 1

const budgetMs = (frames: number) => FRAME_BUDGET_MS * frames * PERF_SLACK

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
    expect(ms).toBeLessThan(budgetMs(1))
    expect(buildLaneRoutes(edges).size).toBe(400)
  })

  it('yToErd for 200×400 stays under 2 frames on average', () => {
    const ydoc = new Y.Doc()
    erdToY(ydoc, generateLargeErd())
    const ms = avgMs(8, () => {
      yToErd(ydoc)
    })
    expect(ms).toBeLessThan(budgetMs(2))
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
    expect(ms).toBeLessThan(budgetMs(1))
    const next = applyErdStructuralPatch(ydoc, prev, events)
    expect(next?.tables.find((t) => t.id === targetId)?.logicalName).toBe(
      'perf-rename',
    )
    expect(next?.tables[1]).toBe(prev.tables[1])
  })

  it('buildLaneRoutes with table obstacles stays under 3 frames for 200×400', () => {
    const doc = generateLargeErd()
    const byId = new Map(doc.tables.map((t) => [t.id, t]))
    const boxes = doc.tables.map((t) => ({ id: t.id, ...tableBox(t) }))
    const edges: RoutedEdge[] = doc.relations.map((rel) => {
      const source = byId.get(rel.sourceTableId)!
      const target = byId.get(rel.targetTableId)!
      const sb = tableBox(source)
      const tb = tableBox(target)
      return {
        id: rel.id,
        sourceId: source.id,
        targetId: target.id,
        sourceX: sb.x + sb.w,
        sourceY: sb.y + sb.h / 2,
        targetX: tb.x,
        targetY: tb.y + tb.h / 2,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      }
    })
    const ms = avgMs(8, () => {
      buildLaneRoutes(edges, boxes)
    })
    expect(ms).toBeLessThan(budgetMs(3))
    const routed = buildLaneRoutes(edges, boxes)
    expect(routed.size).toBe(edges.length)
    // 가운데 레인이 시작·끝 테이블 몸통을 뚫지 않게 경로가 잡혀 있어요.
    let withPath = 0
    for (const route of routed.values()) {
      if (route.path) withPath += 1
    }
    expect(withPath).toBeGreaterThan(edges.length * 0.5)
  })
})
