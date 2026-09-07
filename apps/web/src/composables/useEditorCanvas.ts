import { computed, provide, ref, type ComputedRef, type Ref } from 'vue'
import type { EdgeMouseEvent, NodeDragEvent } from '@vue-flow/core'
import type {
  ErdDocument,
  ErdRelation,
  ErdTable,
  ErdViewSettings,
} from '@erd-studio/shared'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { ErdFlowKey } from '@/composables/useErdFlow'
import { isRelationTool, toolGuide, type Tool } from '@/composables/erd-tools'
import { cyclicRelationIds } from '@/lib/erd-cycles'
import { relationHandles, type NodeSize } from '@/lib/erd-edge-route'

type Reactive<T> = Ref<T> | ComputedRef<T>

type FlowNode = {
  id: string
  type?: string
  data?: Record<string, unknown>
  [key: string]: unknown
}

type FlowEdge = {
  id: string
  source: string
  target: string
  data?: ErdRelation
  [key: string]: unknown
}

export const useEditorCanvas = (opts: {
  erd: Reactive<ErdDocument>
  nodes: Reactive<FlowNode[]>
  edges: Reactive<FlowEdge[]>
  tool: Ref<Tool>
  pendingLink: Ref<string | null>
  selectedId: Ref<string | null>
  selectedColumnId: Ref<string | null>
  selectedEdgeId: Ref<string | null>
  tab: Ref<'props' | 'sql' | 'ai' | 'chat' | 'history'>
  showFlow: Ref<boolean>
  compactLayout: Reactive<boolean>
  inspectorExpanded: Ref<boolean>
  chromeHidden: Ref<boolean>
  focusMode: Ref<boolean>
  readOnly: Reactive<boolean>
  viewSettings: ComputedRef<ErdViewSettings>
  updateTable: (id: string, patch: Partial<ErdTable>) => void
  deleteTable: (id: string) => void
  removeNote: (id: string) => void
  removeRelation: (id: string) => void
  moveNode: (payload: { id: string; position: { x: number; y: number } }) => void
  beginDrag: (id: string) => void
  endDrag: (id: string) => void
  onIgnorePaneClick: () => void
  onClearIgnorePaneClickSoon: () => void
}) => {
  const nodeSizes = ref(new Map<string, NodeSize>())
  const nodeDragging = ref(false)
  const panePanning = ref(false)
  const chromeShowTimer = 0

  const flowFocusId = computed(() => {
    if (!opts.showFlow.value) return null
    return opts.selectedId.value
  })

  const flowNeighborIds = computed(() => {
    const id = flowFocusId.value
    if (!id) return null
    const ids = new Set([id])
    for (const edge of opts.edges.value) {
      if (edge.source === id) ids.add(edge.target)
      if (edge.target === id) ids.add(edge.source)
    }
    return ids
  })

  provide(ErdFlowKey, {
    on: opts.showFlow,
    focusTableId: flowFocusId,
  })

  const canvasHint = computed(() => {
    if (opts.readOnly.value) {
      return '보기 전용이에요. 다이어그램을 수정할 수 없어요'
    }
    const guide = toolGuide(opts.tool.value, Boolean(opts.pendingLink.value))
    if (guide) return guide
    if (!opts.showFlow.value) return ''
    return flowFocusId.value
      ? '연결된 테이블로 흐름이 보여요'
      : '관계 흐름을 켜 두었어요. 테이블을 고르면 연결만 강조돼요'
  })

  const removeCanvasNode = async (id: string) => {
    if (opts.readOnly.value) return
    const table = opts.erd.value.tables.find((item) => item.id === id)
    if (table) {
      const name = table.logicalName || table.physicalName || '이 테이블'
      const ok = await confirm({
        title: '테이블을 삭제할까요?',
        description: `"${name}" 테이블과 연결된 관계가 함께 사라져요. Ctrl+Z로 되돌릴 수 있어요.`,
        confirmLabel: '삭제하기',
        destructive: true,
      })
      if (!ok) return
      opts.deleteTable(id)
      toast('테이블을 삭제했어요. Ctrl+Z로 되돌릴 수 있어요')
    } else {
      const ok = await confirm({
        title: '메모를 삭제할까요?',
        description: 'Ctrl+Z로 되돌릴 수 있어요.',
        confirmLabel: '삭제하기',
        destructive: true,
      })
      if (!ok) return
      opts.removeNote(id)
    }
    if (opts.selectedId.value === id) opts.selectedId.value = null
    opts.selectedColumnId.value = null
    if (opts.pendingLink.value === id) opts.pendingLink.value = null
  }

  const removeCanvasColumn = async (tableId: string, columnId: string) => {
    if (opts.readOnly.value) return
    const table = opts.erd.value.tables.find((item) => item.id === tableId)
    if (!table) return
    if (table.columns.length <= 1) {
      toast('컬럼이 하나일 때는 지울 수 없어요', { kind: 'error' })
      return
    }
    const col = table.columns.find((item) => item.id === columnId)
    const name = col?.logicalName || col?.physicalName || '이 컬럼'
    const ok = await confirm({
      title: '컬럼을 삭제할까요?',
      description: `"${name}" 컬럼이 사라져도 Ctrl+Z로 되돌릴 수 있어요.`,
      confirmLabel: '삭제하기',
      destructive: true,
    })
    if (!ok) return
    opts.updateTable(tableId, {
      columns: table.columns.filter((item) => item.id !== columnId),
    })
    if (opts.selectedColumnId.value === columnId) {
      opts.selectedColumnId.value = null
    }
    toast('컬럼을 삭제했어요. Ctrl+Z로 되돌릴 수 있어요')
  }

  const setNodeSize = (id: string, size: NodeSize) => {
    const prev = nodeSizes.value.get(id)
    if (prev && prev.w === size.w && prev.h === size.h) return
    const next = new Map(nodeSizes.value)
    next.set(id, size)
    nodeSizes.value = next
  }

  const selectColumnHandlers = new Map<string, (id: string | null) => void>()
  const removeColumnHandlers = new Map<string, (id: string) => void>()
  const removeNodeHandlers = new Map<string, () => void>()
  const sizeHandlers = new Map<string, (size: NodeSize) => void>()

  const ensureSelectColumn = (nodeId: string) => {
    let handler = selectColumnHandlers.get(nodeId)
    if (!handler) {
      handler = (id: string | null) => {
        opts.selectedEdgeId.value = null
        if (!id) {
          opts.selectedColumnId.value = null
          return
        }
        opts.selectedId.value = nodeId
        opts.selectedColumnId.value = id
        opts.tab.value = 'props'
        if (opts.compactLayout.value) opts.inspectorExpanded.value = true
      }
      selectColumnHandlers.set(nodeId, handler)
    }
    return handler
  }

  const ensureRemoveColumn = (nodeId: string) => {
    let handler = removeColumnHandlers.get(nodeId)
    if (!handler) {
      handler = (id: string) => removeCanvasColumn(nodeId, id)
      removeColumnHandlers.set(nodeId, handler)
    }
    return handler
  }

  const ensureRemoveNode = (nodeId: string) => {
    let handler = removeNodeHandlers.get(nodeId)
    if (!handler) {
      handler = () => removeCanvasNode(nodeId)
      removeNodeHandlers.set(nodeId, handler)
    }
    return handler
  }

  const ensureSize = (nodeId: string) => {
    let handler = sizeHandlers.get(nodeId)
    if (!handler) {
      handler = (size: NodeSize) => setNodeSize(nodeId, size)
      sizeHandlers.set(nodeId, handler)
    }
    return handler
  }

  const canvasNodes = computed(() =>
    opts.nodes.value.map((node) => ({
      ...node,
      selected: node.id === opts.selectedId.value,
      class:
        flowNeighborIds.value && !flowNeighborIds.value.has(node.id)
          ? 'erd-node-dim'
          : undefined,
      data:
        node.type === 'table'
          ? {
              ...node.data,
              nameMode: opts.viewSettings.value.nameMode,
              show: opts.viewSettings.value.show,
              linking: isRelationTool(opts.tool.value),
              linkSource: opts.pendingLink.value === node.id,
              selectedColumnId:
                node.id === opts.selectedId.value
                  ? opts.selectedColumnId.value
                  : null,
              onSelectColumn: ensureSelectColumn(node.id),
              onRemoveColumn: ensureRemoveColumn(node.id),
              onRemove: ensureRemoveNode(node.id),
              onSize: ensureSize(node.id),
            }
          : {
              ...node.data,
              onRemove: ensureRemoveNode(node.id),
            },
    })),
  )

  const canvasEdges = computed(() => {
    const tables = new Map(
      opts.erd.value.tables.map((table) => [table.id, table] as const),
    )
    const sizes = nodeSizes.value
    const cyclic = cyclicRelationIds(opts.erd.value.relations)
    return opts.edges.value.map((edge) => {
      const rel = edge.data
      const handles = rel
        ? relationHandles(
            tables.get(rel.sourceTableId),
            tables.get(rel.targetTableId),
            rel.sourceColumnIds[0],
            rel.targetColumnIds[0],
            sizes,
          )
        : {}
      return {
        ...edge,
        ...handles,
        selected: edge.id === opts.selectedEdgeId.value,
        data: rel
          ? {
              ...rel,
              cycleWarning:
                cyclic.has(rel.id) || rel.sourceTableId === rel.targetTableId,
            }
          : rel,
      }
    })
  })

  const clearChromeTimer = () => {
    window.clearTimeout(chromeShowTimer)
  }

  const resetChromeMotion = () => {
    window.clearTimeout(chromeShowTimer)
    nodeDragging.value = false
    panePanning.value = false
    opts.chromeHidden.value = false
  }

  const persistNodeMove = (event: NodeDragEvent) => {
    if (opts.readOnly.value) return
    opts.moveNode({ id: event.node.id, position: event.node.position })
  }

  const onDrag = (event: NodeDragEvent) => {
    opts.onIgnorePaneClick()
    nodeDragging.value = true
    opts.beginDrag(event.node.id)
    persistNodeMove(event)
  }

  const onDragStop = (event: NodeDragEvent) => {
    persistNodeMove(event)
    opts.endDrag(event.node.id)
    nodeDragging.value = false
    opts.onClearIgnorePaneClickSoon()
  }

  const onPanStart = () => {
    panePanning.value = true
  }

  const onPanEnd = () => {
    panePanning.value = false
  }

  const onEdgeClick = (event: EdgeMouseEvent) => {
    opts.selectedId.value = null
    opts.selectedColumnId.value = null
    opts.selectedEdgeId.value = event.edge.id
    opts.tab.value = 'props'
    if (opts.compactLayout.value) opts.inspectorExpanded.value = true
  }

  return {
    canvasNodes,
    canvasEdges,
    canvasHint,
    nodeDragging,
    panePanning,
    removeCanvasNode,
    removeCanvasColumn,
    onDrag,
    onDragStop,
    onPanStart,
    onPanEnd,
    onEdgeClick,
    clearChromeTimer,
    resetChromeMotion,
  }
}

