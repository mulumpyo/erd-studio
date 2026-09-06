export type CycleEdge = {
  id: string
  sourceTableId: string
  targetTableId: string
}

const buildAdj = (relations: Array<{ sourceTableId: string; targetTableId: string }>) => {
  const adj = new Map<string, string[]>()
  for (const rel of relations) {
    const list = adj.get(rel.sourceTableId)
    if (list) list.push(rel.targetTableId)
    else adj.set(rel.sourceTableId, [rel.targetTableId])
  }
  return adj
}

const reaches = (
  from: string,
  to: string,
  adj: Map<string, string[]>,
): boolean => {
  if (from === to) return true
  const seen = new Set<string>()
  const stack = [from]
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === to) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    const next = adj.get(cur)
    if (!next) continue
    for (const id of next) stack.push(id)
  }
  return false
}

/** True if adding source→target would introduce a directed cycle (incl. self-FK). */
export const wouldCreateCycle = (
  relations: Array<{ sourceTableId: string; targetTableId: string }>,
  sourceTableId: string,
  targetTableId: string,
): boolean => {
  if (sourceTableId === targetTableId) return true
  return reaches(targetTableId, sourceTableId, buildAdj(relations))
}

/** Relation ids that participate in at least one directed cycle. */
export const cyclicRelationIds = (relations: CycleEdge[]): Set<string> => {
  const adj = buildAdj(relations)
  const cyclic = new Set<string>()
  for (const rel of relations) {
    if (
      rel.sourceTableId === rel.targetTableId ||
      reaches(rel.targetTableId, rel.sourceTableId, adj)
    ) {
      cyclic.add(rel.id)
    }
  }
  return cyclic
}
