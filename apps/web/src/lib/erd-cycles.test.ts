import { describe, expect, it } from 'vitest'
import { cyclicRelationIds, wouldCreateCycle } from '@/lib/erd-cycles'

describe('erd-cycles', () => {
  it('detects that A→B then B→A would cycle', () => {
    expect(
      wouldCreateCycle(
        [{ sourceTableId: 'a', targetTableId: 'b' }],
        'b',
        'a',
      ),
    ).toBe(true)
  })

  it('allows acyclic additions', () => {
    expect(
      wouldCreateCycle(
        [{ sourceTableId: 'a', targetTableId: 'b' }],
        'a',
        'c',
      ),
    ).toBe(false)
  })

  it('treats self-FK as a cycle', () => {
    expect(wouldCreateCycle([], 'a', 'a')).toBe(true)
  })

  it('marks relations that participate in a directed cycle', () => {
    const cyclic = cyclicRelationIds([
      { id: 'r1', sourceTableId: 'a', targetTableId: 'b' },
      { id: 'r2', sourceTableId: 'b', targetTableId: 'c' },
      { id: 'r3', sourceTableId: 'c', targetTableId: 'a' },
      { id: 'r4', sourceTableId: 'a', targetTableId: 'd' },
    ])
    expect([...cyclic].sort()).toEqual(['r1', 'r2', 'r3'])
  })
})
