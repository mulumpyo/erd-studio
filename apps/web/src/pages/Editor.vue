<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { onKeyStroke, useMediaQuery } from '@vueuse/core'
import type { Connection, EdgeMouseEvent, NodeDragEvent, NodeMouseEvent } from '@vue-flow/core'
import {
  mergeViewSettings,
  parseErdFile,
  stringifyErdFile,
  type ErdRelation,
  type ErdTable,
  type ErdViewPatch,
} from '@erd-studio/shared'
import { api, ApiError } from '@/api'
import { errorMessage } from '@/lib/format'
import { collabUrl } from '@/lib/urls'
import {
  downloadDataUrl,
  downloadText,
  safeFilename,
} from '@/lib/download'
import { buildSpecCsv, buildSpecHtml } from '@/lib/erd-spec'
import { canDeleteProject, canLeaveProject, isProjectOwner } from '@/types/workspace'
import { useAuthStore } from '@/stores/auth'
import {
  columnIdFromHandle,
  defaultRelation,
  isRelationTool,
  relationFromTool,
  toolGuide,
} from '@/composables/erd-tools'
import { ErdFlowKey } from '@/composables/useErdFlow'
import { useErdSession } from '@/composables/useErdSession'
import ErdCanvas from '@/components/editor/ErdCanvas.vue'
import Toolbar from '@/components/editor/Toolbar.vue'
import Inspector from '@/components/editor/Inspector.vue'
import SqlPanel from '@/components/editor/SqlPanel.vue'
import ChatPanel from '@/components/editor/ChatPanel.vue'
import HistoryPanel from '@/components/editor/HistoryPanel.vue'
import MembersDialog from '@/components/editor/MembersDialog.vue'
import ProjectSettingsDialog from '@/components/editor/ProjectSettingsDialog.vue'
import EntityList from '@/components/editor/EntityList.vue'
import PresenceAvatars from '@/components/editor/PresenceAvatars.vue'
import ExportMenu from '@/components/editor/ExportMenu.vue'
import EditorOverflowMenu from '@/components/editor/EditorOverflowMenu.vue'
import EditorSidePanel from '@/components/editor/EditorSidePanel.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import SegmentedControl from '@/components/ui/segmented-control/SegmentedControl.vue'
import { toast } from '@/composables/useToast'
import { confirm, useConfirm } from '@/composables/useConfirm'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const projectId = computed(() => String(route.params.id))
const projectName = ref('잠시만요')
const ownerId = ref('')
const isOwner = computed(() =>
  isProjectOwner({ ownerId: ownerId.value }, auth.user?.id),
)
const canLeave = ref(false)
const canDelete = ref(false)
const isParticipant = ref(false)
const isPublic = ref(false)
const tab = ref<'props' | 'sql' | 'chat' | 'history'>('props')
const selectedId = ref<string | null>(null)
const selectedColumnId = ref<string | null>(null)
const selectedEdgeId = ref<string | null>(null)
const showFlow = ref(false)
const pendingLink = ref<string | null>(null)
const loaded = ref(false)
const loadError = ref('')
const membersOpen = ref(false)
const settingsOpen = ref(false)
const entitiesOpen = ref(false)
const inspectorExpanded = ref(false)
const chromeHidden = ref(false)
const nodeDragging = ref(false)
const panePanning = ref(false)
const compactLayout = useMediaQuery('(max-width: 1279px)')
const { open: confirmOpen } = useConfirm()
let deleteBusy = false
let chromeShowTimer = 0
const projectDescription = ref('')
const projectTags = ref<string[]>([])
const localView = ref<ErdViewPatch | null>(null)
const apiReadOnly = ref(true)
const canvasRef = ref<{
  focusNode: (id: string) => void
  capture: (format: 'png' | 'svg') => Promise<string | null>
} | null>(null)

const shareOptions = [
  { value: 'private', label: '비공개' },
  { value: 'public', label: '공개' },
]

const {
  erd,
  nodes,
  edges,
  messages,
  tool,
  connected,
  peers,
  addTable,
  addNote,
  addDomain,
  updateTable,
  updateDomain,
  removeDomain,
  moveNode,
  deleteTable,
  undo,
  redo,
  canUndo,
  canRedo,
  connectTables,
  connectManyToMany,
  replaceDocument,
  updateViewSettings,
  seedFromSnapshot,
  sendChat,
  removeNote,
  removeRelation,
  updateRelation,
  seedRoles,
  setAcl,
  readOnly,
} = useErdSession({
  projectId: projectId.value,
  token: () => auth.collabCredential(),
  collabUrl: collabUrl(),
  userName: auth.user?.name,
  userId: auth.user?.id,
  userEmail: auth.user?.email,
  initial: null,
  readOnly: apiReadOnly,
})

const chatPrimed = ref(false)
const seenChatId = ref<string | null>(null)
const chatIsOpen = computed(() => {
  if (tab.value !== 'chat') return false
  if (compactLayout.value && !inspectorExpanded.value) return false
  return true
})
const markChatSeen = () => {
  seenChatId.value = messages.value.at(-1)?.id ?? seenChatId.value
}
const unreadChatCount = computed(() => {
  if (!chatPrimed.value || chatIsOpen.value) return 0
  const seen = seenChatId.value
  const start = seen
    ? messages.value.findIndex((m) => m.id === seen) + 1
    : 0
  const myId = auth.user?.id
  return messages.value
    .slice(Math.max(start, 0))
    .filter((m) => !myId || m.userId !== myId).length
})
const panelTabs = computed(() => [
  { value: 'props', label: '속성' },
  { value: 'sql', label: 'SQL' },
  {
    value: 'chat',
    label: '채팅',
    badge: unreadChatCount.value || undefined,
  },
  { value: 'history', label: '기록' },
])

watch(connected, (ok) => {
  if (!ok || chatPrimed.value) return
  chatPrimed.value = true
  markChatSeen()
})
watch(messages, () => {
  if (!chatPrimed.value) {
    if (!messages.value.length && !connected.value) return
    chatPrimed.value = true
    markChatSeen()
    return
  }
  if (chatIsOpen.value) markChatSeen()
})
watch(chatIsOpen, (open) => {
  if (open) markChatSeen()
})
watch([unreadChatCount, projectName], () => {
  const name =
    projectName.value && projectName.value !== '잠시만요'
      ? projectName.value
      : 'ERD Studio'
  const n = unreadChatCount.value
  document.title = n > 0 ? `(${n}) ${name}` : name
})

const viewSettings = computed(() =>
  mergeViewSettings(erd.value.settings, localView.value),
)

const patchView = (patch: ErdViewPatch) => {
  if (readOnly.value) {
    localView.value = mergeViewSettings(viewSettings.value, patch)
    return
  }
  updateViewSettings(patch)
}

const selectedTable = computed(
  () => erd.value.tables.find((t) => t.id === selectedId.value) ?? null,
)

const selectedRelation = computed(
  () =>
    erd.value.relations.find((rel) => rel.id === selectedEdgeId.value) ?? null,
)

const flowFocusId = computed(() => {
  if (!showFlow.value) return null
  return selectedTable.value?.id ?? null
})

const flowNeighborIds = computed(() => {
  const id = flowFocusId.value
  if (!id) return null
  const ids = new Set([id])
  for (const edge of edges.value) {
    if (edge.source === id) ids.add(edge.target)
    if (edge.target === id) ids.add(edge.source)
  }
  return ids
})

provide(ErdFlowKey, {
  on: showFlow,
  focusTableId: flowFocusId,
})

const canvasHint = computed(() => {
  const guide = readOnly.value
    ? ''
    : toolGuide(tool.value, Boolean(pendingLink.value))
  if (guide) return guide
  if (!showFlow.value) return ''
  return flowFocusId.value
    ? '연결된 테이블로 흐름이 보여요'
    : '관계 흐름을 켜 두었어요. 테이블을 고르면 연결만 강조돼요'
})

const removeCanvasNode = async (id: string) => {
  if (readOnly.value) return
  const table = erd.value.tables.find((item) => item.id === id)
  if (table) {
    const name = table.logicalName || table.physicalName || '이 테이블'
    const ok = await confirm({
      title: '테이블을 삭제할까요?',
      description: `"${name}" 테이블과 연결된 관계가 함께 사라져요. Ctrl+Z로 되돌릴 수 있어요.`,
      confirmLabel: '삭제하기',
      destructive: true,
    })
    if (!ok) return
    deleteTable(id)
    toast('테이블을 삭제했어요. Ctrl+Z로 되돌릴 수 있어요')
  } else {
    const ok = await confirm({
      title: '메모를 삭제할까요?',
      description: 'Ctrl+Z로 되돌릴 수 있어요.',
      confirmLabel: '삭제하기',
      destructive: true,
    })
    if (!ok) return
    removeNote(id)
  }
  if (selectedId.value === id) selectedId.value = null
  selectedColumnId.value = null
  if (pendingLink.value === id) pendingLink.value = null
}

const removeCanvasColumn = async (tableId: string, columnId: string) => {
  if (readOnly.value) return
  const table = erd.value.tables.find((item) => item.id === tableId)
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
  updateTable(tableId, {
    columns: table.columns.filter((item) => item.id !== columnId),
  })
  if (selectedColumnId.value === columnId) selectedColumnId.value = null
  toast('컬럼을 삭제했어요. Ctrl+Z로 되돌릴 수 있어요')
}
const canvasNodes = computed(() =>
  nodes.value.map((node) => ({
    ...node,
    selected: node.id === selectedId.value,
    class:
      flowNeighborIds.value && !flowNeighborIds.value.has(node.id)
        ? 'erd-node-dim'
        : undefined,
    data:
      node.type === 'table'
        ? {
            ...node.data,
            nameMode: viewSettings.value.nameMode,
            show: viewSettings.value.show,
            linking: isRelationTool(tool.value),
            linkSource: pendingLink.value === node.id,
            selectedColumnId:
              node.id === selectedId.value ? selectedColumnId.value : null,
            onSelectColumn: (id: string | null) => {
              selectedEdgeId.value = null
              if (!id) {
                selectedColumnId.value = null
                return
              }
              selectedId.value = node.id
              selectedColumnId.value = id
              tab.value = 'props'
              if (compactLayout.value) inspectorExpanded.value = true
            },
            onRemoveColumn: (id: string) => removeCanvasColumn(node.id, id),
            onRemove: () => removeCanvasNode(node.id),
          }
        : {
            ...node.data,
            onRemove: () => removeCanvasNode(node.id),
          },
  })),
)

const canvasEdges = computed(() =>
  edges.value.map((edge) => ({
    ...edge,
    selected: edge.id === selectedEdgeId.value,
  })),
)

const isEditingField = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

const onKey = (event: KeyboardEvent) => {
  if (readOnly.value) return
  if (confirmOpen.value) return
  if (isEditingField(event.target)) return
  if (event.key === 'Escape') {
    pendingLink.value = null
    if (isRelationTool(tool.value) || tool.value === 'table' || tool.value === 'note') {
      tool.value = 'select'
    }
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
    event.preventDefault()
    redo()
    return
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault()
    if (deleteBusy) return
    void (async () => {
      deleteBusy = true
      try {
        if (selectedEdgeId.value) {
          const ok = await confirm({
            title: '관계를 삭제할까요?',
            description: 'Ctrl+Z로 되돌릴 수 있어요.',
            confirmLabel: '삭제하기',
            destructive: true,
          })
          if (!ok) return
          removeRelation(selectedEdgeId.value)
          selectedEdgeId.value = null
          toast('관계를 삭제했어요. Ctrl+Z로 되돌릴 수 있어요')
          return
        }
        if (selectedId.value && selectedColumnId.value) {
          await removeCanvasColumn(selectedId.value, selectedColumnId.value)
          return
        }
        if (selectedId.value) await removeCanvasNode(selectedId.value)
      } finally {
        deleteBusy = false
      }
    })()
  }
}

onMounted(async () => {
  try {
    const project = await api<{
      name: string
      description?: string | null
      tags?: string[]
      isPublic: boolean
      isParticipant?: boolean
      canEdit?: boolean
      snapshot: object | null
      ownerId: string
      members?: Array<{ userId: string; role: string }>
      team?: {
        id: string
        name: string
        ownerId: string
        members: Array<{ userId: string; role: string }>
      } | null
    }>(`/api/projects/${projectId.value}`, {}, auth.token)
    projectName.value = project.name
    projectDescription.value = project.description ?? ''
    projectTags.value = project.tags ?? []
    isPublic.value = project.isPublic
    ownerId.value = project.ownerId
    const userId = auth.user?.id
    canLeave.value = canLeaveProject(project, userId)
    canDelete.value = canDeleteProject(project, userId, project.team?.ownerId)
    isParticipant.value = Boolean(
      project.isParticipant ??
        (userId &&
          (project.ownerId === userId ||
            project.members?.some((m) => m.userId === userId) ||
            project.team?.members.some((m) => m.userId === userId))),
    )
    const selfRole =
      project.ownerId === userId
        ? 'owner'
        : (project.members?.find((m) => m.userId === userId)?.role ??
          project.team?.members.find((m) => m.userId === userId)?.role ??
          'viewer')
    const roles: Record<string, string> = { [project.ownerId]: 'owner' }
    if (project.team) {
      for (const m of project.team.members) {
        if (!roles[m.userId]) roles[m.userId] = m.role
      }
    } else {
      for (const m of project.members ?? []) roles[m.userId] = m.role
    }
    seedRoles(roles, project.canEdit === false ? 'viewer' : selfRole)
    seedFromSnapshot(project.snapshot as never)
    apiReadOnly.value = project.canEdit === false
    loaded.value = true
    window.addEventListener('keydown', onKey)
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || (!auth.token && e.status === 404))) {
      router.replace({
        name: 'login',
        query: { redirect: route.fullPath },
      })
      return
    }
    loadError.value = errorMessage(
      e,
      '이 프로젝트에 접근할 수 없어요. 보기 권한이 있는 멤버만 열 수 있어요.',
    )
  }
})

onUnmounted(() => {
  window.clearTimeout(chromeShowTimer)
  window.removeEventListener('keydown', onKey)
  document.title = 'ERD Studio'
})

const onPaneClick = () => {
  selectedEdgeId.value = null
  selectedColumnId.value = null
  if (compactLayout.value && tool.value === 'select' && !pendingLink.value) {
    inspectorExpanded.value = false
  }
  if (pendingLink.value) {
    pendingLink.value = null
    return
  }
  selectedId.value = null
  if (readOnly.value) return
  const offset = {
    x: 120 + erd.value.tables.length * 36,
    y: 100 + erd.value.notes.length * 24,
  }
  if (tool.value === 'table') addTable(offset)
  if (tool.value === 'note') addNote(offset)
}

const applyRelation = (sourceId: string, targetId: string) => {
  if (tool.value === 'many-to-many') {
    connectManyToMany(sourceId, targetId)
  } else {
    const spec = relationFromTool(tool.value) ?? defaultRelation()
    connectTables(
      sourceId,
      targetId,
      undefined,
      undefined,
      spec.kind,
      spec.sourceCardinality,
      spec.targetCardinality,
    )
  }
  pendingLink.value = null
  tool.value = 'select'
  toast('관계를 연결했어요')
}

const onConnect = (params: Connection) => {
  if (readOnly.value) return
  if (!params.source || !params.target) return
  if (params.source === params.target) return
  if (tool.value === 'many-to-many') {
    connectManyToMany(params.source, params.target)
  } else {
    const spec = relationFromTool(tool.value) ?? defaultRelation()
    connectTables(
      params.source,
      params.target,
      columnIdFromHandle(params.sourceHandle),
      columnIdFromHandle(params.targetHandle),
      spec.kind,
      spec.sourceCardinality,
      spec.targetCardinality,
    )
  }
  pendingLink.value = null
  tool.value = 'select'
  toast('관계를 연결했어요')
}

const hideChrome = () => {
  window.clearTimeout(chromeShowTimer)
  chromeHidden.value = true
}

const showChromeSoon = () => {
  window.clearTimeout(chromeShowTimer)
  chromeShowTimer = window.setTimeout(() => {
    if (!nodeDragging.value && !panePanning.value) chromeHidden.value = false
  }, 140)
}

const persistNodeMove = (event: NodeDragEvent) => {
  if (readOnly.value) return
  moveNode({ id: event.node.id, position: event.node.position })
}

const onDrag = (event: NodeDragEvent) => {
  nodeDragging.value = true
  hideChrome()
  persistNodeMove(event)
}

const onDragStop = (event: NodeDragEvent) => {
  persistNodeMove(event)
  nodeDragging.value = false
  showChromeSoon()
}

const onPanStart = () => {
  panePanning.value = true
  hideChrome()
}

const onPanEnd = () => {
  panePanning.value = false
  showChromeSoon()
}

const onNodeClick = (event: NodeMouseEvent) => {
  selectedEdgeId.value = null
  const fromColumn =
    event.event?.target instanceof Element &&
    event.event.target.closest('.col-row')
  if (
    selectedId.value === event.node.id &&
    !fromColumn &&
    !pendingLink.value &&
    !isRelationTool(tool.value)
  ) {
    selectedId.value = null
    selectedColumnId.value = null
    return
  }
  if (!fromColumn) selectedColumnId.value = null
  selectedId.value = event.node.id
  tab.value = 'props'
  if (compactLayout.value) inspectorExpanded.value = true
  if (readOnly.value || event.node.type !== 'table') return
  if (!isRelationTool(tool.value)) return
  if (!pendingLink.value) {
    pendingLink.value = event.node.id
    return
  }
  if (pendingLink.value === event.node.id) return
  applyRelation(pendingLink.value, event.node.id)
}

const onEdgeClick = (event: EdgeMouseEvent) => {
  selectedId.value = null
  selectedColumnId.value = null
  selectedEdgeId.value = event.edge.id
  tab.value = 'props'
  if (compactLayout.value) inspectorExpanded.value = true
}

const onToolChange = (next: typeof tool.value) => {
  tool.value = next
  pendingLink.value = null
}

const rename = async () => {
  if (readOnly.value) return
  await saveProjectMeta({ name: projectName.value })
}

const saveProjectMeta = async (payload: {
  name?: string
  description?: string
  tags?: string[]
}) => {
  if (readOnly.value) return
  try {
    await api(
      `/api/projects/${projectId.value}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
      auth.token,
    )
    if (payload.name) projectName.value = payload.name
    if (payload.description !== undefined)
      projectDescription.value = payload.description
    if (payload.tags) projectTags.value = payload.tags
  } catch (e) {
    toast(errorMessage(e, '프로젝트 정보를 저장하지 못했어요'), {
      kind: 'error',
    })
  }
}

const onSaveSettingsMeta = (payload: {
  name: string
  description: string
  tags: string[]
}) => {
  projectName.value = payload.name
  projectDescription.value = payload.description
  projectTags.value = payload.tags
  void saveProjectMeta(payload)
}

const setPublic = async (next: boolean) => {
  if (!isOwner.value || next === isPublic.value) return
  if (next) {
    const ok = await confirm({
      title: '공개로 바꿀까요?',
      description:
        '링크를 아는 누구나 로그인 없이 볼 수 있어요. 편집은 멤버만 할 수 있어요.',
      confirmLabel: '공개로 바꾸기',
    })
    if (!ok) return
  }
  const prev = isPublic.value
  isPublic.value = next
  try {
    await api(
      `/api/projects/${projectId.value}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isPublic: next }),
      },
      auth.token,
    )
  } catch (e) {
    isPublic.value = prev
    toast(errorMessage(e, '공개 설정을 바꾸지 못했어요'), { kind: 'error' })
  }
}

const copyShare = async () => {
  const url = `${location.origin}/app/${projectId.value}`
  try {
    await navigator.clipboard.writeText(url)
    toast(
      isPublic.value
        ? '링크를 복사했어요. 아는 누구나 볼 수 있어요'
        : '링크를 복사했어요. 보기 권한이 있는 사람만 열 수 있어요',
    )
  } catch {
    await confirm({
      title: '링크를 복사해 주세요',
      description: url,
      confirmLabel: '확인',
      cancelLabel: '닫기',
    })
  }
}

const onUpdateTable = (table: ErdTable) => updateTable(table.id, table)
const reload = () => window.location.reload()

const onSelectTable = (id: string) => {
  selectedEdgeId.value = null
  if (
    selectedId.value === id &&
    !pendingLink.value &&
    !isRelationTool(tool.value)
  ) {
    selectedId.value = null
    selectedColumnId.value = null
    return
  }
  if (selectedId.value !== id) selectedColumnId.value = null
  selectedId.value = id
  tab.value = 'props'
  canvasRef.value?.focusNode(id)
  if (compactLayout.value) entitiesOpen.value = false
  if (compactLayout.value) inspectorExpanded.value = true
  if (readOnly.value || !isRelationTool(tool.value)) return
  if (!pendingLink.value) {
    pendingLink.value = id
    return
  }
  if (pendingLink.value === id) return
  applyRelation(pendingLink.value, id)
}

watch(compactLayout, (compact) => {
  if (!compact) {
    entitiesOpen.value = false
    inspectorExpanded.value = false
  }
})

watch(loaded, (value) => {
  if (!value) return
  window.clearTimeout(chromeShowTimer)
  nodeDragging.value = false
  panePanning.value = false
  chromeHidden.value = false
})

const toggleEntities = () => {
  entitiesOpen.value = !entitiesOpen.value
  if (entitiesOpen.value) inspectorExpanded.value = false
}

onKeyStroke('Escape', () => {
  if (confirmOpen.value) return
  if (entitiesOpen.value) {
    entitiesOpen.value = false
    return
  }
  if (compactLayout.value && inspectorExpanded.value) {
    inspectorExpanded.value = false
  }
})

watch(tab, () => {
  if (compactLayout.value) inspectorExpanded.value = true
})

const fileBase = () => safeFilename(projectName.value)

const exportImage = async (format: 'png' | 'svg') => {
  try {
    const dataUrl = await canvasRef.value?.capture(format)
    if (!dataUrl) {
      toast('내보낼 다이어그램이 없어요', { kind: 'error' })
      return
    }
    downloadDataUrl(dataUrl, `${fileBase()}.${format}`)
  } catch (e) {
    toast(errorMessage(e, '이미지를 저장하지 못했어요'), { kind: 'error' })
  }
}

const exportSpec = (kind: 'html' | 'csv' | 'xls') => {
  const name = fileBase()
  if (kind === 'csv') {
    downloadText(
      buildSpecCsv(erd.value),
      `${name}.csv`,
      'text/csv;charset=utf-8',
    )
    return
  }
  const html = buildSpecHtml(erd.value, projectName.value)
  downloadText(
    html,
    kind === 'xls' ? `${name}.xls` : `${name}.html`,
    kind === 'xls' ? 'application/vnd.ms-excel' : 'text/html;charset=utf-8',
  )
}

const exportJson = () => {
  downloadText(
    stringifyErdFile(erd.value, projectName.value),
    `${fileBase()}.erd.json`,
    'application/json;charset=utf-8',
  )
}

const importJsonFile = async (file: File) => {
  if (readOnly.value) return
  try {
    const text = await file.text()
    const next = parseErdFile(text)
    if (erd.value.tables.length || erd.value.notes.length) {
      const ok = await confirm({
        title: '다이어그램을 바꿀까요?',
        description: '지금 그린 내용이 이 파일로 바뀌어요.',
        confirmLabel: '바꾸기',
        destructive: true,
      })
      if (!ok) return
    }
    replaceDocument(next)
    toast('ERD 파일을 가져왔어요')
  } catch (e) {
    toast(errorMessage(e, 'ERD 파일을 읽지 못했어요'), { kind: 'error' })
  }
}

const onUpdateRelation = (relation: ErdRelation) => updateRelation(relation)

const onRemoveRelation = async () => {
  if (!selectedEdgeId.value) return
  const ok = await confirm({
    title: '관계를 삭제할까요?',
    description: 'Ctrl+Z로 되돌릴 수 있어요.',
    confirmLabel: '삭제하기',
    destructive: true,
  })
  if (!ok) return
  removeRelation(selectedEdgeId.value)
  selectedEdgeId.value = null
  toast('관계를 삭제했어요. Ctrl+Z로 되돌릴 수 있어요')
}

const onRemoveDomain = async (id: string) => {
  const ok = await confirm({
    title: '도메인을 삭제할까요?',
    description: '쓰고 있는 컬럼에서 연결이 풀려요.',
    confirmLabel: '삭제하기',
    destructive: true,
  })
  if (!ok) return
  removeDomain(id)
}

const leaveProject = async () => {
  const ok = await confirm({
    title: '이 프로젝트에서 나갈까요?',
    description: '더 이상 이 다이어그램을 보거나 편집하지 못해요.',
    confirmLabel: '나가기',
  })
  if (!ok) return
  try {
    await api(
      `/api/projects/${projectId.value}/leave`,
      { method: 'DELETE' },
      auth.token,
    )
    router.push('/app')
  } catch (e) {
    toast(errorMessage(e, '나가지 못했어요'), { kind: 'error' })
  }
}

const removeProject = async () => {
  const ok = await confirm({
    title: '프로젝트를 삭제할까요?',
    description: '다이어그램과 멤버 구성이 모두 사라져요. 되돌릴 수 없어요.',
    matchValue: projectName.value,
    matchHint: '프로젝트 이름을 똑같이 입력해 주세요',
    confirmLabel: '삭제하기',
    destructive: true,
  })
  if (!ok) return
  try {
    await api(
      `/api/projects/${projectId.value}`,
      { method: 'DELETE' },
      auth.token,
    )
    router.push('/app')
  } catch (e) {
    toast(errorMessage(e, '삭제하지 못했어요'), { kind: 'error' })
  }
}
</script>

<template>
  <div
    v-if="loadError"
    class="flex h-full flex-col items-center justify-center gap-4 bg-background px-6"
  >
    <p class="text-center text-[17px] font-semibold tracking-[-0.02em] text-foreground">
      {{ loadError }}
    </p>
    <div class="flex gap-2">
      <Button
        v-if="!auth.user"
        @click="
          router.push({ name: 'login', query: { redirect: route.fullPath } })
        "
        >로그인</Button
      >
      <Button
        variant="secondary"
        @click="router.push(auth.user ? '/app' : '/')"
        >나가기</Button
      >
    </div>
  </div>
  <div
    v-else
    class="relative h-svh overflow-hidden bg-background"
    :class="{ 'erd-immersive': chromeHidden }"
  >
    <div class="absolute inset-0">
      <ErdCanvas
        v-if="loaded"
        ref="canvasRef"
        :nodes="canvasNodes"
        :edges="canvasEdges"
        :read-only="readOnly"
        :linking="isRelationTool(tool)"
        :compact="compactLayout"
        @pane-click="onPaneClick"
        @connect="onConnect"
        @pan-start="onPanStart"
        @pan-end="onPanEnd"
        @node-drag="onDrag"
        @node-drag-stop="onDragStop"
        @node-click="onNodeClick"
        @edge-click="onEdgeClick"
      />
    </div>
    <div class="pointer-events-none absolute inset-0 z-20 flex flex-col">
    <header
      class="erd-chrome erd-chrome-top pointer-events-auto relative z-30 flex min-h-16 items-center justify-between gap-2 overflow-visible border-b border-border/80 bg-card px-3 pt-[env(safe-area-inset-top)] sm:px-4"
    >
      <div class="flex min-w-0 items-center gap-2 sm:gap-3">
        <Button
          variant="secondary"
          size="sm"
          class="min-h-11 px-3 xl:min-h-8"
          @click="router.push(auth.user ? '/app' : '/')"
          >목록</Button
        >
        <Input
          v-model="projectName"
          class="h-10 min-w-0 flex-1 bg-muted text-base sm:w-40 sm:flex-none xl:w-56"
          :disabled="readOnly"
          @change="rename"
        />
        <span
          class="inline-flex shrink-0 items-center gap-1.5 rounded-full xl:px-2.5 xl:py-0.5"
          :class="
            connected
              ? 'xl:bg-[#e6f8ef]'
              : 'xl:bg-muted'
          "
          :title="connected ? '연결됨' : '연결 중'"
          :aria-label="connected ? '연결됨' : '연결 중'"
        >
          <span
            class="size-2.5 rounded-full"
            :class="
              connected
                ? 'bg-[#00c471] shadow-[0_0_0_3px_rgb(0_196_113_/_0.22)]'
                : 'animate-pulse bg-[#8b95a1]'
            "
          />
          <span
            class="hidden text-[12px] font-semibold tracking-[-0.01em] xl:inline"
            :class="connected ? 'text-[#0a8f5a]' : 'text-muted-foreground'"
            >{{ connected ? '연결됨' : '연결 중' }}</span
          >
        </span>
        <Badge v-if="readOnly" class="hidden sm:inline-flex">읽기 전용</Badge>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <PresenceAvatars :users="peers" />
        <div class="hidden items-center gap-2 xl:flex">
          <ExportMenu
            @png="exportImage('png')"
            @svg="exportImage('svg')"
            @html="exportSpec('html')"
            @csv="exportSpec('csv')"
            @xls="exportSpec('xls')"
            @json="exportJson"
            @import-json="importJsonFile"
          />
          <Button
            v-if="isParticipant"
            variant="secondary"
            size="sm"
            @click="membersOpen = true"
            >멤버</Button
          >
          <SegmentedControl
            v-if="isOwner"
            :model-value="isPublic ? 'public' : 'private'"
            :options="shareOptions"
            @update:model-value="setPublic($event === 'public')"
          />
          <Button size="sm" variant="secondary" @click="copyShare"
            >링크 복사</Button
          >
          <Button
            v-if="!auth.user"
            size="sm"
            @click="
              router.push({ name: 'login', query: { redirect: route.fullPath } })
            "
            >로그인</Button
          >
          <Button
            v-if="canDelete"
            variant="destructive"
            size="sm"
            @click="removeProject"
            >삭제</Button
          >
          <Button
            v-else-if="canLeave"
            variant="ghost"
            size="sm"
            @click="leaveProject"
            >나가기</Button
          >
        </div>
        <EditorOverflowMenu
          :is-owner="isOwner"
          :is-participant="isParticipant"
          :can-delete="canDelete"
          :can-leave="canLeave"
          :is-public="isPublic"
          :signed-in="Boolean(auth.user)"
          :share-options="shareOptions"
          @members="membersOpen = true"
          @update:public="setPublic"
          @copy-share="copyShare"
          @login="
            router.push({ name: 'login', query: { redirect: route.fullPath } })
          "
          @remove="removeProject"
          @leave="leaveProject"
          @png="exportImage('png')"
          @svg="exportImage('svg')"
          @html="exportSpec('html')"
          @csv="exportSpec('csv')"
          @xls="exportSpec('xls')"
          @json="exportJson"
          @import-json="importJsonFile"
        />
      </div>
    </header>
    <div class="relative min-h-0 flex-1">
      <div
        v-if="canvasHint"
        class="erd-chrome-float pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4"
      >
        <div
          class="rounded-full bg-card/95 px-4 py-2 text-[13px] font-semibold tracking-[-0.02em] text-foreground shadow-[0_8px_24px_rgb(25_31_40_/_0.12)]"
        >
          {{ canvasHint }}
        </div>
      </div>
      <div class="erd-chrome erd-chrome-left pointer-events-auto absolute inset-y-0 left-0 z-20 flex shadow-[8px_0_24px_rgb(25_31_40_/_0.06)]">
      <Toolbar
        class="w-16"
        :current="tool"
        :flow-on="showFlow"
        :read-only="readOnly"
        :can-undo="canUndo"
        :can-redo="canRedo"
        :show-entities-toggle="compactLayout"
        :entities-open="entitiesOpen"
        @change="onToolChange"
        @toggle-flow="showFlow = !showFlow"
        @undo="undo"
        @redo="redo"
        @toggle-entities="toggleEntities"
        @settings="settingsOpen = true"
      />
      <EntityList
        v-if="!compactLayout"
        class="w-60"
        :tables="erd.tables"
        :selected-id="selectedId"
        :name-mode="viewSettings.nameMode"
        @select="onSelectTable"
        @update:name-mode="patchView({ nameMode: $event })"
      />
      </div>
      <div
        :class="
          compactLayout
            ? 'erd-chrome erd-chrome-bottom pointer-events-auto absolute bottom-0 left-16 right-0 z-20'
            : 'erd-chrome erd-chrome-right pointer-events-auto absolute inset-y-0 right-0 z-20 w-[340px] border-l border-border/80 shadow-[-8px_0_24px_rgb(25_31_40_/_0.06)]'
        "
      >
      <EditorSidePanel
        class="h-full"
        :tab="tab"
        :tabs="panelTabs"
        :compact="compactLayout"
        :expanded="inspectorExpanded"
        @update:tab="tab = $event as 'props' | 'sql' | 'chat' | 'history'"
        @toggle="inspectorExpanded = !inspectorExpanded"
      >
          <Inspector
            v-if="tab === 'props'"
            key="props"
            :table="selectedTable"
            :relation="selectedRelation"
            :tables="erd.tables"
            :domains="erd.domains"
            :read-only="readOnly"
            :selected-column-id="selectedColumnId"
            @update="onUpdateTable"
            @select-column="selectedColumnId = $event"
            @remove="selectedId && removeCanvasNode(selectedId)"
            @update-relation="onUpdateRelation"
            @remove-relation="onRemoveRelation"
            @add-domain="addDomain"
            @update-domain="updateDomain"
            @remove-domain="onRemoveDomain"
          />
          <SqlPanel
            v-else-if="tab === 'sql'"
            key="sql"
            :document="erd"
            :read-only="readOnly"
            @import="replaceDocument"
          />
          <ChatPanel
            v-else-if="tab === 'chat'"
            key="chat"
            :messages="messages"
            :read-only="readOnly"
            @send="sendChat"
          />
          <HistoryPanel
            v-else
            key="history"
            :project-id="projectId"
            :document="erd"
            :read-only="readOnly"
            @restored="reload"
          />
      </EditorSidePanel>
      </div>
      <div
        v-if="compactLayout && entitiesOpen"
        class="erd-chrome erd-chrome-left pointer-events-auto absolute inset-y-0 left-16 right-0 z-30 xl:hidden"
      >
        <button
          type="button"
          class="absolute inset-0 bg-[#191f28]/25"
          aria-label="엔티티 목록 닫기"
          @click="entitiesOpen = false"
        />
        <EntityList
          overlay
          class="absolute inset-y-0 left-0 w-60 shadow-[8px_0_32px_rgb(25_31_40_/_0.16)]"
          :tables="erd.tables"
          :selected-id="selectedId"
          :name-mode="viewSettings.nameMode"
          @select="onSelectTable"
          @close="entitiesOpen = false"
          @update:name-mode="patchView({ nameMode: $event })"
        />
      </div>
    </div>
    </div>
    <ProjectSettingsDialog
      v-model:open="settingsOpen"
      :name="projectName"
      :description="projectDescription"
      :tags="projectTags"
      :view="viewSettings"
      :read-only="readOnly"
      @save-meta="onSaveSettingsMeta"
      @update-view="patchView"
    />
    <MembersDialog
      v-model:open="membersOpen"
      :project-id="projectId"
      :owner-id="ownerId"
      :is-public="isPublic"
      @acl="setAcl($event.userId, $event.role)"
    />
  </div>
</template>
