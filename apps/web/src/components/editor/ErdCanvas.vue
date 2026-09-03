<script setup lang="ts">
import { computed, markRaw, nextTick, ref, toValue } from 'vue'
import { toPng, toSvg } from 'html-to-image'
import {
  VueFlow,
  useVueFlow,
  type Connection,
  type EdgeMouseEvent,
  type NodeDragEvent,
  type NodeMouseEvent,
} from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import '@vue-flow/minimap/dist/style.css'
import TableNode from '@/components/editor/TableNode.vue'
import NoteNode from '@/components/editor/NoteNode.vue'
import CrowEdge from '@/components/editor/CrowEdge.vue'
import CanvasControls from '@/components/editor/CanvasControls.vue'
import { useTheme } from '@/composables/useTheme'

const props = withDefaults(
  defineProps<{
    nodes: unknown[]
    edges: unknown[]
    readOnly?: boolean
    linking?: boolean
    flowId?: string
  }>(),
  { flowId: 'erd-canvas' },
)

const emit = defineEmits<{
  paneClick: []
  connect: [params: Connection]
  nodeDrag: [event: NodeDragEvent]
  nodeClick: [event: NodeMouseEvent]
  edgeClick: [event: EdgeMouseEvent]
}>()

const { resolved: theme } = useTheme()
const patternColor = computed(() =>
  theme.value === 'dark' ? '#3a3d46' : '#e5e8eb',
)
const canvasColor = computed(() =>
  theme.value === 'dark' ? '#1c1d22' : '#f2f4f6',
)
const {
  fitView,
  getNodes,
  updateNodeInternals,
  getViewport,
  setViewport,
  setMinZoom,
  minZoom,
} = useVueFlow({
  id: props.flowId,
})
const nodeTypes = { table: markRaw(TableNode), note: markRaw(NoteNode) } as never
const edgeTypes = { crow: markRaw(CrowEdge) } as never
const rootRef = ref<HTMLElement | null>(null)
const onlyVisible = ref(true)
const exporting = ref(false)
const viewLocked = ref(false)
const canMoveNodes = computed(() => !props.readOnly && !viewLocked.value)

const focusNode = (id: string) => {
  fitView({ nodes: [id], padding: 0.42, duration: 280 })
}

const viewportEl = () =>
  rootRef.value?.querySelector('.vue-flow__viewport') as HTMLElement | null

const flowEl = () =>
  rootRef.value?.querySelector('.vue-flow') as HTMLElement | null

const waitFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

const waitMs = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

const nodeEl = (id: string) =>
  rootRef.value?.querySelector(
    `.vue-flow__node[data-id="${CSS.escape(id)}"]`,
  ) as HTMLElement | null

const waitForNodeLayout = async (ids: string[]) => {
  for (let i = 0; i < 40; i++) {
    const ready = ids.every((id) => {
      const el = nodeEl(id)
      return Boolean(el && el.offsetWidth > 0 && el.offsetHeight > 0)
    })
    if (ready) return
    await nextTick()
    await waitFrame()
  }
}

const exportFilter = (node: HTMLElement) =>
  !node.classList?.contains('vue-flow__edge-interaction') &&
  !node.classList?.contains('vue-flow__minimap') &&
  !node.classList?.contains('vue-flow__controls') &&
  !node.classList?.contains('table-head-delete') &&
  !node.classList?.contains('col-delete') &&
  !node.classList?.contains('note-delete')

const capture = async (format: 'png' | 'svg') => {
  const el = flowEl()
  if (!el) return null
  const prevViewport = getViewport()
  const prevMinZoom = toValue(minZoom)
  onlyVisible.value = false
  exporting.value = true
  try {
    await nextTick()
    const nodes = toValue(getNodes)
    if (!nodes.length) return null
    const ids = nodes.map((node) => node.id)
    await waitForNodeLayout(ids)
    updateNodeInternals(ids)
    await nextTick()
    await waitFrame()
    setMinZoom(0.05)
    await fitView({
      padding: '96px',
      includeHiddenNodes: true,
      duration: 0,
      minZoom: 0.05,
      maxZoom: 1.25,
    })
    await nextTick()
    await waitFrame()
    await waitFrame()
    await waitMs(50)
    const width = Math.round(el.clientWidth)
    const height = Math.round(el.clientHeight)
    const options = {
      backgroundColor: canvasColor.value,
      cacheBust: true,
      width,
      height,
      filter: exportFilter,
    }
    if (format === 'png') {
      const pixelRatio = Math.min(
        2,
        8192 / Math.max(width, 1),
        8192 / Math.max(height, 1),
      )
      return await toPng(el, { ...options, pixelRatio })
    }
    return await toSvg(el, options)
  } finally {
    setMinZoom(prevMinZoom)
    await setViewport(prevViewport, { duration: 0 })
    onlyVisible.value = true
    exporting.value = false
  }
}

defineExpose({ focusNode, capture, viewportEl })
</script>

<template>
  <div
    ref="rootRef"
    class="relative h-full min-h-0 min-w-0"
    :class="{
      'erd-exporting': exporting,
      'erd-linking': linking,
      'erd-view-locked': viewLocked,
    }"
  >
    <VueFlow
      :id="flowId"
      :nodes="nodes as never"
      :edges="edges as never"
      :node-types="nodeTypes"
      :edge-types="edgeTypes"
      :nodes-draggable="canMoveNodes"
      :nodes-connectable="canMoveNodes"
      :pan-on-drag="!viewLocked"
      :zoom-on-scroll="!viewLocked"
      :zoom-on-pinch="!viewLocked"
      :zoom-on-double-click="!viewLocked"
      :only-render-visible-elements="onlyVisible"
      :min-zoom="0.05"
      :delete-key-code="null"
      fit-view-on-init
      @pane-click="emit('paneClick')"
      @connect="emit('connect', $event)"
      @node-drag="emit('nodeDrag', $event)"
      @node-drag-stop="emit('nodeDrag', $event)"
      @node-click="emit('nodeClick', $event)"
      @edge-click="emit('edgeClick', $event)"
    >
      <Background :pattern-color="patternColor" :gap="20" />
      <CanvasControls v-model:locked="viewLocked" :read-only="readOnly" />
      <MiniMap />
    </VueFlow>
  </div>
</template>

<style>
.erd-exporting .vue-flow__minimap,
.erd-exporting .vue-flow__controls,
.erd-exporting .vue-flow__edge-interaction,
.erd-exporting .table-head-delete,
.erd-exporting .col-delete,
.erd-exporting .note-delete,
.erd-exporting .erd-flow-line {
  display: none !important;
}
.erd-exporting .vue-flow__edges path {
  fill: none !important;
}
.erd-view-locked .vue-flow__pane {
  cursor: default;
}
</style>
