<script setup lang="ts">
import { computed, markRaw, nextTick, ref, toValue } from 'vue'
import { toPng, toSvg } from 'html-to-image'
import {
  VueFlow,
  getRectOfNodes,
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
    compact?: boolean
  }>(),
  { flowId: 'erd-canvas' },
)

const emit = defineEmits<{
  paneClick: []
  connect: [params: Connection]
  nodeDragStart: [event: NodeDragEvent]
  nodeDrag: [event: NodeDragEvent]
  nodeDragStop: [event: NodeDragEvent]
  nodeClick: [event: NodeMouseEvent]
  edgeClick: [event: EdgeMouseEvent]
  panStart: []
  panEnd: []
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
} = useVueFlow(props.flowId)
const nodeTypes = { table: markRaw(TableNode), note: markRaw(NoteNode) } as never
const edgeTypes = { crow: markRaw(CrowEdge) } as never
const rootRef = ref<HTMLElement | null>(null)
const onlyVisible = ref(true)
const exporting = ref(false)
const viewLocked = ref(false)
const canMoveNodes = computed(() => !props.readOnly && !viewLocked.value)
const allowPan = computed(() => !viewLocked.value || Boolean(props.compact))
let panePanning = false

const isUserPan = (payload: { event?: { sourceEvent?: Event | null } | Event | null }) => {
  const event = payload.event
  if (!event || event instanceof WheelEvent) return false
  const source =
    'sourceEvent' in event ? event.sourceEvent : event
  if (!source || source instanceof WheelEvent) return false
  const type = source.type
  return (
    type === 'mousemove' ||
    type === 'pointermove' ||
    type === 'touchmove' ||
    type === 'mousedown' ||
    type === 'pointerdown' ||
    type === 'touchstart'
  )
}

const onMove = (payload: { event?: { sourceEvent?: Event } | Event | null }) => {
  if (!isUserPan(payload)) return
  if (panePanning) return
  panePanning = true
  emit('panStart')
}

const onMoveEnd = () => {
  if (!panePanning) return
  panePanning = false
  emit('panEnd')
}

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

const EXPORT_PAD = 128
const MIN_LONG_SIDE = 1920
const MAX_LONG_SIDE = 4096
const MAX_CANVAS_SIDE = 8192
const MAX_CANVAS_AREA = 16_777_216

const exportFrame = (nodes: ReturnType<typeof getNodes>) => {
  const rect = getRectOfNodes(nodes)
  const contentW = Math.max(rect.width + EXPORT_PAD * 2, 320)
  const contentH = Math.max(rect.height + EXPORT_PAD * 2, 240)
  const long = Math.max(contentW, contentH)
  const scale = Math.min(MAX_LONG_SIDE / long, Math.max(1, MIN_LONG_SIDE / long))
  return {
    width: Math.round(contentW * scale),
    height: Math.round(contentH * scale),
  }
}

const pngPixelRatio = (width: number, height: number) => {
  const areaCap = Math.sqrt(MAX_CANVAS_AREA / Math.max(width * height, 1))
  return Math.max(
    1,
    Math.min(3, areaCap, MAX_CANVAS_SIDE / width, MAX_CANVAS_SIDE / height),
  )
}

const applyExportSize = (el: HTMLElement, width: number, height: number) => {
  const prev = {
    width: el.style.width,
    height: el.style.height,
    minWidth: el.style.minWidth,
    minHeight: el.style.minHeight,
    maxWidth: el.style.maxWidth,
    maxHeight: el.style.maxHeight,
  }
  el.style.width = `${width}px`
  el.style.height = `${height}px`
  el.style.minWidth = `${width}px`
  el.style.minHeight = `${height}px`
  el.style.maxWidth = 'none'
  el.style.maxHeight = 'none'
  return () => {
    el.style.width = prev.width
    el.style.height = prev.height
    el.style.minWidth = prev.minWidth
    el.style.minHeight = prev.minHeight
    el.style.maxWidth = prev.maxWidth
    el.style.maxHeight = prev.maxHeight
  }
}

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
  const root = rootRef.value
  if (!el || !root) return null
  const prevViewport = getViewport()
  const prevMinZoom = toValue(minZoom)
  onlyVisible.value = false
  exporting.value = true
  let restoreSize = () => {}
  try {
    await nextTick()
    const nodes = toValue(getNodes)
    if (!nodes.length) return null
    const ids = nodes.map((node) => node.id)
    await waitForNodeLayout(ids)
    updateNodeInternals(ids)
    await nextTick()
    await waitFrame()
    const frame = exportFrame(nodes)
    restoreSize = applyExportSize(root, frame.width, frame.height)
    await nextTick()
    await waitFrame()
    setMinZoom(0.05)
    await fitView({
      padding: '96px',
      includeHiddenNodes: true,
      duration: 0,
      minZoom: 0.05,
      maxZoom: 8,
    })
    await nextTick()
    await waitFrame()
    await waitFrame()
    await waitMs(50)
    const options = {
      backgroundColor: canvasColor.value,
      cacheBust: true,
      width: frame.width,
      height: frame.height,
      filter: exportFilter,
    }
    if (format === 'png') {
      return await toPng(el, {
        ...options,
        pixelRatio: pngPixelRatio(frame.width, frame.height),
      })
    }
    return await toSvg(el, options)
  } finally {
    restoreSize()
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
      'erd-compact': compact,
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
      :pan-on-drag="allowPan"
      :zoom-on-scroll="allowPan"
      :zoom-on-pinch="allowPan"
      :zoom-on-double-click="allowPan && !compact"
      :node-drag-threshold="compact ? 10 : 0"
      :only-render-visible-elements="onlyVisible"
      :min-zoom="0.05"
      :delete-key-code="null"
      fit-view-on-init
      @pane-click="emit('paneClick')"
      @connect="emit('connect', $event)"
      @move="onMove"
      @move-end="onMoveEnd"
      @node-drag-start="emit('nodeDragStart', $event)"
      @node-drag="emit('nodeDrag', $event)"
      @node-drag-stop="emit('nodeDragStop', $event)"
      @node-click="emit('nodeClick', $event)"
      @edge-click="emit('edgeClick', $event)"
    >
      <Background :pattern-color="patternColor" :gap="20" />
      <CanvasControls
        v-model:locked="viewLocked"
        :read-only="readOnly"
        :nodes-only="compact"
      />
      <MiniMap
        pannable
        :width="compact ? 112 : 200"
        :height="compact ? 76 : 150"
        aria-label="미니맵"
      />
    </VueFlow>
    <div
      v-if="compact && viewLocked"
      class="erd-lock-hint pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4"
    >
      <div
        class="rounded-full bg-card/95 px-4 py-2 text-[13px] font-semibold tracking-[-0.02em] text-foreground shadow-[0_8px_24px_rgb(25_31_40_/_0.12)]"
      >
        테이블을 고정했어요. 빈 곳을 밀어 화면을 옮기세요
      </div>
    </div>
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

.erd-compact .canvas-ctrl {
  width: 44px;
  height: 44px;
}
</style>
