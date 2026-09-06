import type { ComputedRef, Ref } from 'vue'
import type { Connection, NodeMouseEvent } from '@vue-flow/core'
import type {
  Cardinality,
  ErdDocument,
  RelationKind,
} from '@erd-studio/shared'
import {
  columnIdFromHandle,
  defaultRelation,
  isRelationTool,
  relationFromTool,
  type Tool,
} from '@/composables/erd-tools'
import { wouldCreateCycle } from '@/lib/erd-cycles'
import { toast } from '@/composables/useToast'

type Position = { x: number; y: number }
type Reactive<T> = Ref<T> | ComputedRef<T>

type ConnectTables = (
  sourceId: string,
  targetId: string,
  sourceColumnId?: string,
  targetColumnId?: string,
  kind?: RelationKind,
  sourceCardinality?: Cardinality,
  targetCardinality?: Cardinality,
) => void

export const useEditorTools = (opts: {
  tool: Ref<Tool>
  pendingLink: Ref<string | null>
  selectedId: Ref<string | null>
  selectedColumnId: Ref<string | null>
  selectedEdgeId: Ref<string | null>
  tab: Ref<'props' | 'sql' | 'chat' | 'history'>
  compactLayout: Reactive<boolean>
  inspectorExpanded: Ref<boolean>
  readOnly: Reactive<boolean>
  erd: Reactive<ErdDocument>
  addTable: (position: Position) => void
  addNote: (position: Position) => void
  connectTables: ConnectTables
  connectManyToMany: (sourceId: string, targetId: string) => void
}) => {
  let ignorePaneClick = false

  const markIgnorePaneClick = () => {
    ignorePaneClick = true
  }

  const clearIgnorePaneClickSoon = () => {
    window.setTimeout(() => {
      ignorePaneClick = false
    }, 50)
  }

  const onToolChange = (next: Tool) => {
    opts.tool.value = next
    opts.pendingLink.value = null
  }

  const applyRelation = (sourceId: string, targetId: string) => {
    const cycle = wouldCreateCycle(
      opts.erd.value.relations,
      sourceId,
      targetId,
    )
    if (opts.tool.value === 'many-to-many') {
      if (sourceId === targetId) {
        toast('같은 테이블로는 N:M을 만들 수 없어요', { kind: 'error' })
        opts.pendingLink.value = null
        opts.tool.value = 'select'
        return
      }
      opts.connectManyToMany(sourceId, targetId)
    } else {
      const spec = relationFromTool(opts.tool.value) ?? defaultRelation()
      opts.connectTables(
        sourceId,
        targetId,
        undefined,
        undefined,
        spec.kind,
        spec.sourceCardinality,
        spec.targetCardinality,
      )
    }
    opts.pendingLink.value = null
    opts.tool.value = 'select'
    toast(
      cycle
        ? sourceId === targetId
          ? '자기 참조 관계를 연결했어요'
          : '관계를 연결했어요. 순환 참조가 생겼어요'
        : '관계를 연결했어요',
    )
  }

  const onPaneClick = (position: Position) => {
    if (ignorePaneClick) {
      ignorePaneClick = false
      return
    }
    opts.selectedEdgeId.value = null
    opts.selectedColumnId.value = null
    if (
      opts.compactLayout.value &&
      opts.tool.value === 'select' &&
      !opts.pendingLink.value
    ) {
      opts.inspectorExpanded.value = false
    }
    if (opts.pendingLink.value) {
      opts.pendingLink.value = null
      return
    }
    opts.selectedId.value = null
    if (opts.readOnly.value) return
    if (opts.tool.value === 'table') opts.addTable(position)
    if (opts.tool.value === 'note') opts.addNote(position)
  }

  const onConnect = (params: Connection) => {
    if (opts.readOnly.value) return
    if (!params.source || !params.target) return
    const cycle = wouldCreateCycle(
      opts.erd.value.relations,
      params.source,
      params.target,
    )
    if (opts.tool.value === 'many-to-many') {
      if (params.source === params.target) {
        toast('같은 테이블로는 N:M을 만들 수 없어요', { kind: 'error' })
        opts.pendingLink.value = null
        opts.tool.value = 'select'
        return
      }
      opts.connectManyToMany(params.source, params.target)
    } else {
      const spec = relationFromTool(opts.tool.value) ?? defaultRelation()
      opts.connectTables(
        params.source,
        params.target,
        columnIdFromHandle(params.sourceHandle),
        columnIdFromHandle(params.targetHandle),
        spec.kind,
        spec.sourceCardinality,
        spec.targetCardinality,
      )
    }
    opts.pendingLink.value = null
    opts.tool.value = 'select'
    toast(
      cycle
        ? params.source === params.target
          ? '자기 참조 관계를 연결했어요'
          : '관계를 연결했어요. 순환 참조가 생겼어요'
        : '관계를 연결했어요',
    )
  }

  const beginRelationFromTable = (tableId: string) => {
    if (opts.readOnly.value || !isRelationTool(opts.tool.value)) return false
    if (!opts.pendingLink.value) {
      opts.pendingLink.value = tableId
      return true
    }
    applyRelation(opts.pendingLink.value, tableId)
    return true
  }

  const onNodeClick = (event: NodeMouseEvent) => {
    opts.selectedEdgeId.value = null
    const fromColumn =
      event.event?.target instanceof Element &&
      event.event.target.closest('.col-row')
    if (
      opts.selectedId.value === event.node.id &&
      !fromColumn &&
      !opts.pendingLink.value &&
      !isRelationTool(opts.tool.value)
    ) {
      opts.selectedId.value = null
      opts.selectedColumnId.value = null
      return
    }
    if (!fromColumn) opts.selectedColumnId.value = null
    opts.selectedId.value = event.node.id
    opts.tab.value = 'props'
    if (opts.compactLayout.value) opts.inspectorExpanded.value = true
    if (opts.readOnly.value || event.node.type !== 'table') return
    beginRelationFromTable(event.node.id)
  }

  const resetToolOnEscape = () => {
    opts.pendingLink.value = null
    if (
      isRelationTool(opts.tool.value) ||
      opts.tool.value === 'table' ||
      opts.tool.value === 'note'
    ) {
      opts.tool.value = 'select'
    }
  }

  return {
    onToolChange,
    onPaneClick,
    onConnect,
    onNodeClick,
    applyRelation,
    beginRelationFromTable,
    resetToolOnEscape,
    markIgnorePaneClick,
    clearIgnorePaneClickSoon,
  }
}
