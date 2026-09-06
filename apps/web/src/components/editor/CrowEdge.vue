<script setup lang="ts">
import { computed } from 'vue'
import {
  BaseEdge,
  EdgeLabelRenderer,
  Position,
  getSmoothStepPath,
  type EdgeProps,
} from '@vue-flow/core'
import type { ErdRelation } from '@erd-studio/shared'
import { smoothStepRoute, type RoutedEdge } from '@/lib/erd-edge-route'
import { useErdFlow } from '@/composables/useErdFlow'
import { useErdLaneRoutes } from '@/composables/useErdLaneRoutes'

type EdgeData = ErdRelation & { cycleWarning?: boolean }

const props = defineProps<EdgeProps<EdgeData>>()
const flowView = useErdFlow()
const laneRoutes = useErdLaneRoutes()

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
  const route =
    laneRoutes?.value.get(props.id) ?? smoothStepRoute(self, [self])
  return getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
    ...route,
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
const cycleWarning = computed(
  () =>
    Boolean(props.data?.cycleWarning) ||
    props.source === props.target,
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
    :interaction-width="32"
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
      class="erd-edge-label"
      :style="{
        position: 'absolute',
        transform: `translate(-50%, -50%) translate(${path[1]}px, ${path[2]}px)`,
        pointerEvents: 'none',
        opacity: dimmed ? 0.35 : 1,
      }"
    >
      <span
        v-if="cycleWarning"
        class="erd-cycle-badge"
        title="순환 참조(또는 자기 참조)예요"
        aria-label="순환 참조 경고"
      >
        !
      </span>
      <span class="erd-edge-card">{{ label }}</span>
    </div>
  </EdgeLabelRenderer>
</template>

<style scoped>
.erd-edge-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.erd-edge-card {
  background: var(--card);
  box-shadow: 0 4px 12px rgb(25 31 40 / 0.08);
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: var(--muted-foreground);
  padding: 2px 8px;
}
.erd-cycle-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--canvas-cycle-badge);
  color: var(--canvas-cycle-badge-fg);
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  box-shadow: 0 2px 8px rgb(245 158 11 / 0.35);
}
</style>
