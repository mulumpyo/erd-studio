<script setup lang="ts">
import { computed, toValue } from 'vue'
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getSmoothStepPath,
  useVueFlow,
  type EdgeProps,
} from '@vue-flow/core'
import type { ErdRelation } from '@erd-studio/shared'
import {
  smoothStepRoute,
  type RoutedEdge,
} from '@/lib/erd-edge-route'
import { useErdFlow } from '@/composables/useErdFlow'

const props = defineProps<EdgeProps<ErdRelation>>()
const { getEdges } = useVueFlow()
const flowView = useErdFlow()

const along = (position: Position, intoNode: boolean): [number, number] => {
  switch (position) {
    case Position.Left:
      return intoNode ? [1, 0] : [-1, 0]
    case Position.Right:
      return intoNode ? [-1, 0] : [1, 0]
    case Position.Top:
      return intoNode ? [0, 1] : [0, -1]
    default:
      return intoNode ? [0, -1] : [0, 1]
  }
}

const asRouted = (edge: {
  id: string
  sourceX?: number
  sourceY?: number
  targetX?: number
  targetY?: number
  sourcePosition?: Position
  targetPosition?: Position
}): RoutedEdge | null => {
  if (
    edge.sourceX == null ||
    edge.sourceY == null ||
    edge.targetX == null ||
    edge.targetY == null ||
    !edge.sourcePosition ||
    !edge.targetPosition
  ) {
    return null
  }
  return {
    id: edge.id,
    sourceX: edge.sourceX,
    sourceY: edge.sourceY,
    targetX: edge.targetX,
    targetY: edge.targetY,
    sourcePosition: edge.sourcePosition,
    targetPosition: edge.targetPosition,
  }
}

const path = computed(() => {
  const self: RoutedEdge = {
    id: props.id,
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  }
  const peers = toValue(getEdges)
    .map((edge) => asRouted(edge))
    .filter((edge): edge is RoutedEdge => Boolean(edge))
  const all = peers.some((edge) => edge.id === self.id)
    ? peers.map((edge) => (edge.id === self.id ? self : edge))
    : [...peers, self]
  return getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
    ...smoothStepRoute(self, all),
  })
})

const dashed = computed(() => props.data?.kind === 'non-identifying')
const flowing = computed(() => Boolean(flowView?.on.value))
const focused = computed(() => {
  const id = flowView?.focusTableId.value
  return Boolean(id && (props.source === id || props.target === id))
})
const dimmed = computed(
  () => flowing.value && Boolean(flowView?.focusTableId.value) && !focused.value,
)
const label = computed(() => {
  const rel = props.data
  if (!rel) return ''
  return `${rel.sourceCardinality}:${rel.targetCardinality}`
})

const stroke = {
  fill: 'none',
  stroke: 'var(--muted-foreground)',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const crowPath = computed(() => {
  const [dx, dy] = along(props.targetPosition, true)
  const size = 10
  const x = props.targetX
  const y = props.targetY
  const px = -dy * size
  const py = dx * size
  return `M ${x + px} ${y + py} L ${x - dx * size} ${y - dy * size} L ${x - px} ${y - py}`
})

const barPath = computed(() => {
  const [dx, dy] = along(props.sourcePosition, false)
  const size = 7
  const x = props.sourceX + dx * 3
  const y = props.sourceY + dy * 3
  const px = -dy * size
  const py = dx * size
  return `M ${x + px} ${y + py} L ${x - px} ${y - py}`
})
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path[0]"
    :style="{
      ...stroke,
      strokeDasharray: dashed ? '6 4' : undefined,
      opacity: dimmed ? 0.22 : 1,
    }"
    :interaction-width="20"
  />
  <path
    v-if="flowing && !dimmed"
    class="erd-flow-line"
    :class="{ 'erd-flow-line-focus': focused }"
    fill="none"
    :d="path[0]"
    pointer-events="none"
  />
  <path
    fill="none"
    :d="barPath"
    :style="{ ...stroke, opacity: dimmed ? 0.22 : 1 }"
  />
  <path
    fill="none"
    :d="crowPath"
    :style="{ ...stroke, opacity: dimmed ? 0.22 : 1 }"
  />
  <EdgeLabelRenderer>
    <div
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${path[1]}px, ${path[2]}px)`,
        pointerEvents: 'none',
        opacity: dimmed ? 0.35 : 1,
        background: 'var(--card)',
        border: '0',
        boxShadow: '0 4px 12px rgb(25 31 40 / 0.08)',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: '700',
        color: 'var(--muted-foreground)',
        padding: '2px 8px',
      }"
    >
      {{ label }}
    </div>
  </EdgeLabelRenderer>
</template>
