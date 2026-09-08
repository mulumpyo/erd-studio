<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { onKeyStroke, useMediaQuery } from '@vueuse/core'
import {
  mergeViewSettings,
  parseErdFile,
  stringifyErdFile,
  type ErdDocument,
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
import { isRelationTool } from '@/composables/erd-tools'
import { useErdSession } from '@/composables/useErdSession'
import { useEditorCanvas } from '@/composables/useEditorCanvas'
import { useEditorTools } from '@/composables/useEditorTools'
import { clearCanvasInsets, syncCanvasInsets } from '@/composables/useCanvasInsets'
import { setDocumentTitle } from '@/lib/seo'
import ErdCanvas from '@/components/editor/ErdCanvas.vue'
import EditorChrome from '@/components/editor/EditorChrome.vue'
import Toolbar from '@/components/editor/Toolbar.vue'
import Inspector from '@/components/editor/Inspector.vue'
import SqlPanel from '@/components/editor/SqlPanel.vue'
import AiPanel from '@/components/editor/AiPanel.vue'
import ChatPanel from '@/components/editor/ChatPanel.vue'
import HistoryPanel from '@/components/editor/HistoryPanel.vue'
import MembersDialog from '@/components/editor/MembersDialog.vue'
import ProjectSettingsDialog from '@/components/editor/ProjectSettingsDialog.vue'
import EntityList from '@/components/editor/EntityList.vue'
import EditorSidePanel from '@/components/editor/EditorSidePanel.vue'
import Button from '@/components/ui/button/Button.vue'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import { toast } from '@/composables/useToast'
import { confirm, useConfirm } from '@/composables/useConfirm'
import { markProjectChatSeen, setOpenChatProject } from '@/composables/useChatInbox'
import { onNotifyListsChange } from '@/composables/useNotifications'
import {
  connectionStatusLabel,
  isConnectionUnhealthy,
  syncStatusLabel,
} from '@/lib/collab-status'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const projectId = computed(() => String(route.params.id))
const projectName = ref('잠시만요')
const ownerId = ref('')
const teamId = ref<string | null>(null)
const isOwner = computed(() =>
  isProjectOwner({ ownerId: ownerId.value }, auth.user?.id),
)
const showTeamManage = computed(
  () => Boolean(auth.user && teamId.value && !isOwner.value),
)
const goTeam = () => {
  if (!teamId.value) return
  void router.push({ name: 'team', params: { teamId: teamId.value } })
}
let stopListNotify: (() => void) | null = null
const canLeave = ref(false)
const canDelete = ref(false)
const isParticipant = ref(false)
const isPublic = ref(false)
const tab = ref<'props' | 'sql' | 'ai' | 'chat' | 'history'>('props')
const aiSeedPrompt = ref('')
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
const focusMode = ref(false)
const compactLayout = useMediaQuery('(max-width: 1279px)')
const { open: confirmOpen } = useConfirm()
let deleteBusy = false
const projectDescription = ref('')
const projectTags = ref<string[]>([])
const localView = ref<ErdViewPatch | null>(null)
const apiReadOnly = ref(true)
const canvasRef = ref<{
  focusNode: (id: string) => void
  capture: (format: 'png' | 'svg') => Promise<string | null>
} | null>(null)
const headerRef = ref<HTMLElement | null>(null)

const syncInsets = () => {
  syncCanvasInsets({
    focus: focusMode.value,
    compact: compactLayout.value,
    header: headerRef.value?.offsetHeight ?? 64,
  })
}

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
  connectionStatus,
  syncStatus,
  reconnect,
  peers,
  addTable,
  addNote,
  addDomain,
  updateTable,
  updateDomain,
  removeDomain,
  moveNode,
  beginDrag,
  endDrag,
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
  if (chatIsOpen.value && auth.user?.id) {
    markProjectChatSeen(auth.user.id, projectId.value)
  }
}

const persistChat = (body: string) => {
  sendChat(body)
  void api(
    `/api/projects/${projectId.value}/chat`,
    { method: 'POST', body: JSON.stringify({ body }) },
    auth.token,
  ).catch((e) => {
    toast(errorMessage(e, '채팅 서버 저장에 실패했어요. 화면에는 남았을 수 있어요'), {
      kind: 'error',
      ms: 4000,
    })
  })
}

const openChatFromQuery = () => {
  if (route.query.tab !== 'chat') return
  tab.value = 'chat'
  inspectorExpanded.value = true
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
  { value: 'ai', label: 'AI' },
  {
    value: 'chat',
    label: '채팅',
    badge: unreadChatCount.value || undefined,
  },
  { value: 'history', label: '버전' },
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
watch(
  () => route.query.tab,
  () => openChatFromQuery(),
  { immediate: true },
)
watch([unreadChatCount, projectName], () => {
  const page =
    projectName.value && projectName.value !== '잠시만요'
      ? projectName.value
      : '다이어그램'
  setDocumentTitle(page, unreadChatCount.value)
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

const {
  onToolChange,
  onPaneClick,
  onConnect,
  onNodeClick,
  beginRelationFromTable,
  resetToolOnEscape,
  markIgnorePaneClick,
  clearIgnorePaneClickSoon,
} = useEditorTools({
  tool,
  pendingLink,
  selectedId,
  selectedColumnId,
  selectedEdgeId,
  tab,
  compactLayout,
  inspectorExpanded,
  readOnly,
  erd,
  addTable,
  addNote,
  connectTables,
  connectManyToMany,
})

const {
  canvasNodes,
  canvasEdges,
  canvasHint,
  nodeDragging,
  removeCanvasNode,
  removeCanvasColumn,
  onDrag,
  onDragStop,
  onPanStart,
  onPanEnd,
  onEdgeClick,
  clearChromeTimer,
  resetChromeMotion,
} = useEditorCanvas({
  erd,
  nodes,
  edges,
  tool,
  pendingLink,
  selectedId,
  selectedColumnId,
  selectedEdgeId,
  tab,
  showFlow,
  compactLayout,
  inspectorExpanded,
  chromeHidden,
  focusMode,
  readOnly,
  viewSettings,
  updateTable,
  deleteTable,
  removeNote,
  removeRelation,
  moveNode,
  beginDrag,
  endDrag,
  onIgnorePaneClick: markIgnorePaneClick,
  onClearIgnorePaneClickSoon: clearIgnorePaneClickSoon,
})

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
  if (confirmOpen.value) return
  if (isEditingField(event.target)) return
  if (event.key === 'Escape') {
    if (readOnly.value) return
    resetToolOnEscape()
    return
  }
  if (!readOnly.value && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const hotkeys: Record<string, typeof tool.value> = {
      v: 'select',
      t: 'table',
      n: 'note',
      i: 'identifying',
      r: 'non-identifying',
      o: 'one-to-one',
      m: 'many-to-many',
    }
    const nextTool = hotkeys[event.key.toLowerCase()]
    if (nextTool) {
      event.preventDefault()
      onToolChange(nextTool)
      return
    }
    if (event.key === 'Enter' && selectedId.value && isRelationTool(tool.value)) {
      event.preventDefault()
      beginRelationFromTable(selectedId.value)
      return
    }
  }
  if (readOnly.value) return
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
    teamId.value = project.team?.id ?? null
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
    stopListNotify = onNotifyListsChange(onProjectNotify)
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
      '이 프로젝트에 접근할 수 없어요. 보기 권한이 있는 팀원만 열 수 있어요.',
    )
  }
})

watch(
  [chatIsOpen, projectId],
  ([open, id]) => {
    setOpenChatProject(open ? id : null)
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('resize', syncInsets)
  syncInsets()
})

onUnmounted(() => {
  clearChromeTimer()
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', syncInsets)
  stopListNotify?.()
  setOpenChatProject(null)
  clearCanvasInsets()
})

const exitFocusMode = () => {
  focusMode.value = false
}

const refreshProjectName = async () => {
  try {
    const project = await api<{ name: string }>(
      `/api/projects/${projectId.value}`,
      {},
      auth.token,
    )
    if (project.name && project.name !== projectName.value) {
      projectName.value = project.name
    }
  } catch {
    /* keep the name we already have */
  }
}

const onProjectNotify = (event?: {
  type?: string
  teamId?: string
  projectId?: string
}) => {
  if (event?.type === 'project') {
    if (event.projectId && event.projectId !== projectId.value) return
    void refreshProjectName()
    return
  }
}

const createFirstTable = async () => {
  if (readOnly.value) return
  const before = new Set(erd.value.tables.map((t) => t.id))
  addTable({ x: 180, y: 160 })
  await nextTick()
  const created = erd.value.tables.find((t) => !before.has(t.id))
  if (!created) return
  selectedId.value = created.id
  selectedColumnId.value = null
  selectedEdgeId.value = null
  tab.value = 'props'
  inspectorExpanded.value = true
  entitiesOpen.value = false
  canvasRef.value?.focusNode(created.id)
}

const openAiPanel = (seed = '') => {
  if (readOnly.value) return
  aiSeedPrompt.value = seed
  tab.value = 'ai'
  inspectorExpanded.value = true
  entitiesOpen.value = false
}

const applyAiDocument = async (doc: ErdDocument) => {
  if (readOnly.value) return
  replaceDocument(doc)
  await nextTick()
  selectedId.value = doc.tables[0]?.id ?? selectedId.value
  selectedColumnId.value = null
  selectedEdgeId.value = null
  if (selectedId.value) canvasRef.value?.focusNode(selectedId.value)
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
    throw e
  }
}

const onSaveSettingsMeta = async (payload: {
  name: string
  description: string
  tags: string[]
}) => {
  const prev = {
    name: projectName.value,
    description: projectDescription.value,
    tags: [...projectTags.value],
  }
  projectName.value = payload.name
  projectDescription.value = payload.description
  projectTags.value = payload.tags
  try {
    await saveProjectMeta(payload)
  } catch {
    projectName.value = prev.name
    projectDescription.value = prev.description
    projectTags.value = prev.tags
  }
}

const setPublic = async (next: boolean) => {
  if (!isOwner.value || next === isPublic.value) return
  if (next) {
    const ok = await confirm({
      title: '공개로 바꿀까요?',
      description:
        '링크를 아는 누구나 로그인 없이 볼 수 있어요. 편집은 팀원만 할 수 있어요.',
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
  beginRelationFromTable(id)
}

watch(compactLayout, (compact) => {
  if (!compact) {
    entitiesOpen.value = false
    inspectorExpanded.value = false
  }
})

watch(focusMode, (on) => {
  syncInsets()
  if (!on) return
  entitiesOpen.value = false
  inspectorExpanded.value = false
  pendingLink.value = null
  if (!readOnly.value) tool.value = 'select'
})

watch(compactLayout, syncInsets)

watch(loaded, (value) => {
  if (!value) return
  resetChromeMotion()
  void nextTick(syncInsets)
})

const toggleEntities = () => {
  entitiesOpen.value = !entitiesOpen.value
  if (entitiesOpen.value) inspectorExpanded.value = false
}

onKeyStroke('Escape', () => {
  if (confirmOpen.value) return
  if (focusMode.value) {
    exitFocusMode()
    return
  }
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
    description: '다이어그램과 팀원 구성이 모두 사라져요. 되돌릴 수 없어요.',
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
    <p class="text-center text-[17px] font-semibold tracking-[-0.01em] text-foreground">
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
    class="fixed inset-x-0 overflow-hidden bg-background"
    :class="{
      'erd-immersive': chromeHidden || focusMode,
      'erd-focus': focusMode,
    }"
    style="top: var(--vv-offset-top, 0px); height: var(--vv-height, 100svh)"
  >
    <div class="absolute inset-0">
      <Spinner
        v-if="!loaded"
        class="absolute inset-0 z-[5] bg-background"
        size="lg"
        label="다이어그램을 불러오고 있어요"
      />
      <ErdCanvas
        v-if="loaded"
        ref="canvasRef"
        v-model:focus="focusMode"
        :nodes="canvasNodes"
        :edges="canvasEdges"
        :read-only="readOnly"
        :linking="isRelationTool(tool)"
        :compact="compactLayout"
        :hint="focusMode ? '' : canvasHint"
        :empty="!erd.tables.length && !erd.notes.length"
        @pane-click="onPaneClick"
        @connect="onConnect"
        @pan-start="onPanStart"
        @pan-end="onPanEnd"
        @node-drag="onDrag"
        @node-drag-stop="onDragStop"
        @node-click="onNodeClick"
        @edge-click="onEdgeClick"
        @create-table="createFirstTable"
        @open-ai="openAiPanel()"
      />
    </div>
    <div
      id="erd-canvas-controls"
      class="pointer-events-auto absolute z-10"
      :class="
        focusMode
          ? 'bottom-4 left-4'
          : compactLayout
            ? 'bottom-[calc(var(--erd-sheet-peek,7.5rem)+0.75rem)] left-20'
            : 'bottom-4 left-[4.75rem] xl:left-[19.75rem]'
      "
    />
    <div class="pointer-events-none absolute inset-0 z-20 flex flex-col">
    <EditorChrome
      v-model:header-el="headerRef"
      v-model:project-name="projectName"
      :connection-status="connectionStatus"
      :sync-status="syncStatus"
      :read-only="readOnly"
      :peers="peers"
      :is-owner="isOwner"
      :is-participant="isParticipant"
      :can-delete="canDelete"
      :can-leave="canLeave"
      :is-public="isPublic"
      :signed-in="Boolean(auth.user)"
      :show-team-manage="showTeamManage"
      :share-options="shareOptions"
      @rename="rename"
      @back="router.push(auth.user ? '/app' : '/')"
      @members="membersOpen = true"
      @manage-team="goTeam"
      @update:public="setPublic"
      @copy-share="copyShare"
      @reconnect="reconnect"
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
    <div
      v-if="isConnectionUnhealthy(connectionStatus)"
      class="erd-status-sticky pointer-events-auto relative z-40 flex items-center justify-between gap-3 border-b border-[var(--editor-offline-dot)]/30 bg-[var(--editor-offline-bg)] px-3 py-2 text-[13px] text-[var(--editor-offline-fg)] sm:px-4"
      role="alert"
    >
      <p class="min-w-0 leading-5">
        <span class="font-semibold">{{ connectionStatusLabel(connectionStatus) }}</span>
        —
        {{
          connectionStatus === 'auth_failed'
            ? '다시 로그인한 뒤 재연결해 주세요. 편집이 서버에 반영되지 않을 수 있어요.'
            : '편집이 서버에 반영되지 않을 수 있어요. 연결을 다시 시도해 주세요.'
        }}
        <span class="opacity-80"> · {{ syncStatusLabel(syncStatus) }}</span>
      </p>
      <Button
        size="sm"
        variant="secondary"
        class="h-9 shrink-0"
        @click="reconnect"
        >다시 연결</Button
      >
    </div>
    <div class="relative min-h-0 flex-1">
      <div class="erd-chrome erd-chrome-left pointer-events-auto absolute inset-y-0 left-0 z-20 flex shadow-[8px_0_24px_rgb(28_25_23_/_0.06)]">
      <Toolbar
        class="w-16"
        :current="nodeDragging ? 'select' : tool"
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
        @create-table="createFirstTable"
      />
      </div>
      <div
        data-erd-sheet-host
        :class="
          compactLayout
            ? 'erd-chrome erd-chrome-bottom pointer-events-none absolute inset-y-0 left-16 right-0 z-20 flex flex-col justify-end'
            : 'erd-chrome erd-chrome-right pointer-events-auto absolute inset-y-0 right-0 z-20 w-[340px] border-l border-border/80 shadow-[-8px_0_24px_rgb(28_25_23_/_0.06)]'
        "
      >
      <EditorSidePanel
        class="h-full"
        :tab="tab"
        :tabs="panelTabs"
        :compact="compactLayout"
        :expanded="inspectorExpanded"
        @update:tab="tab = $event as 'props' | 'sql' | 'ai' | 'chat' | 'history'"
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
            @create-table="createFirstTable"
            @open-ai="openAiPanel()"
          />
          <SqlPanel
            v-else-if="tab === 'sql'"
            key="sql"
            :document="erd"
            :read-only="readOnly"
            @import="replaceDocument"
          />
          <AiPanel
            v-else-if="tab === 'ai'"
            :key="`ai-${aiSeedPrompt}`"
            :document="erd"
            :read-only="readOnly"
            :initial-prompt="aiSeedPrompt"
            @apply="applyAiDocument"
          />
          <ChatPanel
            v-else-if="tab === 'chat'"
            key="chat"
            :messages="messages"
            :read-only="readOnly"
            @send="persistChat"
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
          class="absolute inset-0 bg-[var(--editor-overlay)]"
          aria-label="엔티티 목록 닫기"
          @click="entitiesOpen = false"
        />
        <EntityList
          overlay
          class="absolute inset-y-0 left-0 w-60 shadow-[8px_0_32px_rgb(28_25_23_/_0.16)]"
          :tables="erd.tables"
          :selected-id="selectedId"
          :name-mode="viewSettings.nameMode"
          @select="onSelectTable"
          @close="entitiesOpen = false"
          @update:name-mode="patchView({ nameMode: $event })"
          @create-table="createFirstTable"
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
