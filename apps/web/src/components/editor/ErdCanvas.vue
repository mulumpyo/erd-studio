<script setup lang="ts">
import { computed, markRaw, nextTick, onMounted, provide, ref, toValue } from 'vue'
import { toPng, toSvg } from 'html-to-image'
import {
  VueFlow,
  getRectOfNodes,
  useVueFlow,
  type Connection,
  type EdgeMouseEvent,
  type NodeDragEvent,
  type NodeMouseEvent,
  type Position,
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
import { visibleFitPadding } from '@/composables/useCanvasInsets'
import { useTheme } from '@/composables/useTheme'
import {
  buildLaneRoutes,
  type NodeBox,
  type RoutedEdge,
} from '@/lib/erd-edge-route'
import { ErdLaneRoutesKey } from '@/composables/useErdLaneRoutes'

const props = withDefaults(
  defineProps<{
    nodes: unknown[]
    edges: unknown[]
    readOnly?: boolean
    linking?: boolean
    flowId?: string
    compact?: boolean
    hint?: string
    empty?: boolean
  }>(),
  { flowId: 'erd-canvas' },
)

const emit = defineEmits<{
  paneClick: [position: { x: number; y: number }]
  connect: [params: Connection]
  nodeDragStart: [event: NodeDragEvent]
  nodeDrag: [event: NodeDragEvent]
  nodeDragStop: [event: NodeDragEvent]
  nodeClick: [event: NodeMouseEvent]
  edgeClick: [event: EdgeMouseEvent]
  panStart: []
  panEnd: []
  createTable: []
  openAi: []
}>()

const { resolved: theme } = useTheme()
const cssColor = (name: string, fallback: string) => {
  if (typeof document === 'undefined') return fallback
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return value || fallback
}
const patternColor = computed(() => {
  void theme.value
  return cssColor('--pattern', '#e4e2dc')
})
const canvasColor = computed(() => {
  void theme.value
  return cssColor('--canvas', '#f6f5f2')
})
const {
  fitView,
  getNodes,
  getEdges,
  updateNodeInternals,
  getViewport,
  setViewport,
  setMinZoom,
  minZoom,
  screenToFlowCoordinate,
} = useVueFlow(props.flowId)
const nodeTypes = { table: markRaw(TableNode), note: markRaw(NoteNode) } as never
const edgeTypes = { crow: markRaw(CrowEdge) } as never
const rootRef = ref<HTMLElement | null>(null)

const asRouted = (edge: {
  id: string
  source?: string
  target?: string
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
    sourceId: edge.source,
    targetId: edge.target,
  }
}

const asTableBox = (node: {
  id: string
  type?: string
  position: { x: number; y: number }
  dimensions?: { width?: number; height?: number }
}): NodeBox | null => {
  if (node.type && node.type !== 'table') return null
  const w = node.dimensions?.width
  const h = node.dimensions?.height
  if (!w || !h) return null
  return {
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    w,
    h,
  }
}

/** One O(E log E) lane build per frame; CrowEdge looks up by id (no peer scan). */
const laneRoutes = computed(() => {
  // Touch node geometry so drag/resize invalidates the shared lane cache.
  const nodes = toValue(getNodes)
  const boxes: NodeBox[] = []
  for (const node of nodes) {
    void node.position.x
    void node.position.y
    void node.dimensions?.width
    void node.dimensions?.height
    const box = asTableBox(node)
    if (box) boxes.push(box)
  }
  const routed: RoutedEdge[] = []
  for (const edge of toValue(getEdges)) {
    const item = asRouted(edge)
    if (item) routed.push(item)
  }
  return buildLaneRoutes(routed, boxes)
})
provide(ErdLaneRoutesKey, laneRoutes)
const onlyVisible = ref(true)
const exporting = ref(false)
const viewLocked = ref(false)
const focusMode = defineModel<boolean>('focus', { default: false })
const canMoveNodes = computed(() => !props.readOnly && !viewLocked.value)
const allowPan = computed(() => !viewLocked.value || Boolean(props.compact))
let panePanning = false

const isUserPan = (payload: { event?: unknown }) => {
  const event = payload.event
  if (!event || typeof event !== 'object') return false
  if (event instanceof WheelEvent) return false
  const raw =
    'sourceEvent' in event
      ? (event as { sourceEvent?: Event | null }).sourceEvent
      : (event as Event)
  if (!raw || !(raw instanceof Event) || raw instanceof WheelEvent) return false
  const type = raw.type
  return (
    type === 'mousemove' ||
    type === 'pointermove' ||
    type === 'touchmove' ||
    type === 'mousedown' ||
    type === 'pointerdown' ||
    type === 'touchstart'
  )
}

const onMove = (payload: { event?: unknown }) => {
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

const onPaneClick = (payload: MouseEvent | { event?: MouseEvent }) => {
  const event = payload instanceof MouseEvent ? payload : payload.event
  if (!event) return
  emit(
    'paneClick',
    screenToFlowCoordinate({ x: event.clientX, y: event.clientY }),
  )
}

const focusNode = (id: string) => {
  fitView({ nodes: [id], padding: visibleFitPadding(48), duration: 280 })
}

onMounted(async () => {
  await nextTick()
  await fitView({ padding: visibleFitPadding(), duration: 0 })
})

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

const exportFrame = (nodes: typeof getNodes.value) => {
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
      padding: '96px' as `${number}px`,
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
    class="relative h-full min-h-0 min-w-0 bg-[var(--canvas)]"
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
      @pane-click="onPaneClick"
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
        v-model:focus="focusMode"
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
    <div v-if="hint" class="erd-visible-hud pointer-events-none">
      <div
        class="rounded-full bg-card/95 px-4 py-2 text-center text-[13px] font-semibold tracking-[-0.01em] text-foreground shadow-[0_8px_24px_rgb(28_25_23_/_0.12)]"
      >
        {{ hint }}
      </div>
    </div>
    <div
      v-if="empty && !readOnly"
      class="pointer-events-none absolute inset-0 z-[4] flex items-center justify-center p-6"
    >
      <div
        class="pointer-events-auto max-w-sm rounded-3xl bg-card/95 px-6 py-7 text-center shadow-[0_16px_40px_rgb(28_25_23_/_0.14)] ring-1 ring-border/70"
      >
        <p class="text-[17px] font-bold tracking-[-0.02em]">
          첫 테이블을 만들어 보세요
        </p>
        <p class="mt-2 text-[14px] leading-6 text-muted-foreground">
          버튼을 누르거나, 왼쪽에서 「테이블」을 고른 뒤 빈 곳을 클릭하세요.
          설명만 적어도 AI가 초안을 그려 줄 수 있어요.
        </p>
        <div class="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            class="inline-flex h-11 items-center justify-center rounded-2xl bg-primary px-5 text-[14px] font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            @click="emit('createTable')"
          >
            테이블 추가
          </button>
          <button
            type="button"
            class="inline-flex h-11 items-center justify-center rounded-2xl bg-secondary px-5 text-[14px] font-semibold text-secondary-foreground hover:bg-secondary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            @click="emit('openAi')"
          >
            AI로 스키마 만들기
          </button>
        </div>
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
