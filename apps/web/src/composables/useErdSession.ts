import { computed, isRef, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { Ref } from 'vue'
import * as Y from 'yjs'
import { HocuspocusProvider } from '@hocuspocus/provider'
import {
  defaultColumn,
  defaultDomain,
  defaultNote,
  defaultTable,
  emptyDocument,
  pkColumn,
  type Cardinality,
  type ErdDocument,
  type ErdDomain,
  type ErdNote,
  type ErdRelation,
  type ErdTable,
  type ErdViewPatch,
  type RelationKind,
} from '@erd-studio/shared'
import {
  DRAG_ORIGIN,
  aclMap,
  domainsMap,
  erdToY,
  getAclRole,
  getSchemaId,
  getTable,
  isDocEmpty,
  layoutsMap,
  notesMap,
  patchNote,
  patchPosition,
  patchTable,
  patchViewSettings,
  pushChat,
  relationsMap,
  removeDomain,
  removeNote,
  removeRelation,
  removeTable,
  seedIfEmpty,
  setAclRole,
  schemasMap,
  settingsMap,
  tablesMap,
  upsertDomain,
  upsertNote,
  upsertRelation,
  upsertTable,
  yToChat,
  yToErd,
  type ChatLine,
} from '@erd-studio/yjs-erd'
import { planForeignKeyLink } from '@/lib/erd-relations'
import { relationHandles } from '@/lib/erd-edge-route'
import { applyErdStructuralPatch } from '@/lib/erd-session-patch'
import type {
  CollabConnectionStatus,
  CollabSyncStatus,
} from '@/lib/collab-status'
import { type Tool } from './erd-tools'

export type { Tool } from './erd-tools'
export { relationFromTool } from './erd-tools'
export type { CollabConnectionStatus, CollabSyncStatus } from '@/lib/collab-status'

export type CollabUser = {
  id?: string
  name: string
  email?: string
  color: string
  self?: boolean
}

const COLORS = [
  'var(--color-primary, #4f46e5)',
  '#00c471',
  '#f04452',
  '#8b5cf6',
  '#f59e0b',
  '#0ea5e9',
]

const colorFor = (key: string) => {
  let hash = 0
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return COLORS[Math.abs(hash) % COLORS.length]
}

const throttleRaf = <T>(fn: (arg: T) => void) => {
  let frame = 0
  let latest: T | null = null
  return (arg: T) => {
    latest = arg
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (latest) fn(latest)
    })
  }
}

export const useErdSession = (options: {
  projectId?: string
  token?:
    | string
    | null
    | (() => string | null | undefined | Promise<string | null | undefined>)
  collabUrl?: string
  initial?: ErdDocument | null
  userName?: string
  userId?: string
  userEmail?: string
  readOnly?: boolean | Ref<boolean>
}) => {
  const ydoc = shallowRef(new Y.Doc())
  const erd = shallowRef<ErdDocument>(options.initial ?? emptyDocument())
  const messages = ref<ChatLine[]>([])
  const hasCollab = Boolean(options.projectId && options.collabUrl)
  const connectionStatus = ref<CollabConnectionStatus>(
    hasCollab ? 'connecting' : 'idle',
  )
  const syncStatus = ref<CollabSyncStatus>(hasCollab ? 'syncing' : 'local')
  const connected = computed(() => connectionStatus.value === 'connected')
  const peers = ref<CollabUser[]>([])
  const tool = ref<Tool>('select')
  const myRole = ref('viewer')
  const draggingIds = new Set<string>()
  let syncIdleTimer = 0
  const readOnly = computed(() => {
    const opt = options.readOnly
    if (isRef(opt)) return Boolean(opt.value)
    return Boolean(opt)
  })
  const canUndo = ref(false)
  const canRedo = ref(false)
  let provider: HocuspocusProvider | null = null
  let undoManager: Y.UndoManager | null = null
  const canEdit = () => !readOnly.value

  const setConnectionStatus = (next: CollabConnectionStatus) => {
    connectionStatus.value = next
    if (next === 'connected') {
      // synced event / local updates refine syncStatus
      if (syncStatus.value === 'offline' || syncStatus.value === 'syncing') {
        syncStatus.value = 'synced'
      }
      return
    }
    if (next === 'connecting') {
      syncStatus.value = 'syncing'
      return
    }
    if (next === 'disconnected' || next === 'auth_failed') {
      syncStatus.value = 'offline'
      return
    }
    syncStatus.value = 'local'
  }

  const noteLocalSync = () => {
    if (connectionStatus.value !== 'connected') {
      if (hasCollab) syncStatus.value = 'offline'
      return
    }
    syncStatus.value = 'syncing'
    window.clearTimeout(syncIdleTimer)
    syncIdleTimer = window.setTimeout(() => {
      if (connectionStatus.value === 'connected') syncStatus.value = 'synced'
    }, 700)
  }
  const tablePatchHandlers = new Map<
    string,
    (patch: Partial<ErdTable>) => void
  >()
  const tableAddColumnHandlers = new Map<string, () => void>()
  const notePatchHandlers = new Map<string, (patch: Partial<ErdNote>) => void>()

  const refreshUndo = () => {
    canUndo.value = undoManager?.canUndo() ?? false
    canRedo.value = undoManager?.canRedo() ?? false
  }

  const resetUndo = () => {
    undoManager?.clear()
    refreshUndo()
  }

  const syncRoleFromAcl = () => {
    if (!options.userId) return
    const next = getAclRole(ydoc.value, options.userId)
    if (typeof next === 'string') myRole.value = next
  }

  const refreshErd = () => {
    const next = yToErd(ydoc.value)
    if (draggingIds.size) {
      for (const id of draggingIds) {
        const liveTable = erd.value.tables.find((t) => t.id === id)
        const nextTable = next.tables.find((t) => t.id === id)
        if (liveTable && nextTable) nextTable.position = { ...liveTable.position }
        const liveNote = erd.value.notes.find((n) => n.id === id)
        const nextNote = next.notes.find((n) => n.id === id)
        if (liveNote && nextNote) nextNote.position = { ...liveNote.position }
      }
    }
    erd.value = next
    pruneHandlers(next)
  }

  const pruneHandlers = (next: ErdDocument) => {
    const tableIds = new Set(next.tables.map((t) => t.id))
    const noteIds = new Set(next.notes.map((n) => n.id))
    for (const id of tablePatchHandlers.keys()) {
      if (!tableIds.has(id)) {
        tablePatchHandlers.delete(id)
        tableAddColumnHandlers.delete(id)
      }
    }
    for (const id of notePatchHandlers.keys()) {
      if (!noteIds.has(id)) notePatchHandlers.delete(id)
    }
  }

  const applyStructuralPatch = (events: Y.YEvent<any>[]) => {
    const next = applyErdStructuralPatch(
      ydoc.value,
      erd.value,
      events,
      draggingIds,
    )
    if (!next || next === erd.value) return Boolean(next)
    erd.value = next
    pruneHandlers(next)
    return true
  }

  const refreshChat = () => {
    messages.value = yToChat(ydoc.value)
  }

  const onErdMapsChange = (
    events: Y.YEvent<any>[],
    transaction: { origin: unknown },
  ) => {
    if (transaction.origin === DRAG_ORIGIN) return
    if (applyStructuralPatch(events)) return
    refreshErd()
  }

  const onChatChange = () => {
    refreshChat()
  }

  onMounted(() => {
    const doc = ydoc.value
    tablesMap(doc).observeDeep(onErdMapsChange)
    relationsMap(doc).observeDeep(onErdMapsChange)
    notesMap(doc).observeDeep(onErdMapsChange)
    domainsMap(doc).observeDeep(onErdMapsChange)
    layoutsMap(doc).observeDeep(onErdMapsChange)
    schemasMap(doc).observeDeep(onErdMapsChange)
    settingsMap(doc).observeDeep(onErdMapsChange)
    chatArrayObserve(doc, onChatChange)
    aclMap(doc).observe(syncRoleFromAcl)
    undoManager = new Y.UndoManager(
      [
        tablesMap(ydoc.value),
        relationsMap(ydoc.value),
        notesMap(ydoc.value),
        domainsMap(ydoc.value),
        layoutsMap(ydoc.value),
      ],
      {
        trackedOrigins: new Set([null, DRAG_ORIGIN]),
        captureTimeout: 400,
      },
    )
    undoManager.on('stack-item-added', refreshUndo)
    undoManager.on('stack-item-popped', refreshUndo)
    undoManager.on('stack-cleared', refreshUndo)
    refreshErd()
    refreshChat()
    if (options.initial) seedIfEmpty(ydoc.value, options.initial)
    resetUndo()

    const accessToken = () =>
      typeof options.token === 'function' ? options.token() : options.token
    if (options.projectId && options.collabUrl) {
      provider = new HocuspocusProvider({
        url: options.collabUrl,
        name: options.projectId,
        token: async () => {
          const value = await accessToken()
          if (value === '') return ''
          return value || 'public-read'
        },
        document: ydoc.value,
      })
      const syncPeers = () => {
        const awareness = provider?.awareness
        if (!awareness) return
        const seen = new Map<string, CollabUser>()
        awareness.getStates().forEach((state, clientId) => {
          const raw = (state as { user?: CollabUser }).user
          const name = raw?.name?.trim()
          if (!name) return
          const key = raw?.id || `client:${clientId}`
          if (seen.has(key)) return
          seen.set(key, {
            id: raw?.id,
            name,
            email: raw?.email,
            color: raw?.color || colorFor(key),
            self: clientId === awareness.clientID,
          })
        })
        peers.value = [...seen.values()].sort(
          (a, b) => Number(Boolean(b.self)) - Number(Boolean(a.self)),
        )
      }
      const onDocUpdate = (_update: Uint8Array, origin: unknown) => {
        // Remote provider sync should not flash "동기화 중".
        if (origin === provider) return
        if (connectionStatus.value === 'connected') noteLocalSync()
      }
      ydoc.value.on('update', onDocUpdate)
      provider.on('synced', () => {
        setConnectionStatus('connected')
        syncStatus.value = 'synced'
        if (options.initial && isDocEmpty(ydoc.value))
          seedIfEmpty(ydoc.value, options.initial)
        syncRoleFromAcl()
        refreshErd()
        refreshChat()
        resetUndo()
        syncPeers()
      })
      provider.on('disconnect', () => setConnectionStatus('disconnected'))
      provider.on('close', () => setConnectionStatus('disconnected'))
      provider.on('authenticationFailed', () =>
        setConnectionStatus('auth_failed'),
      )
      provider.on('status', ({ status }: { status?: string }) => {
        if (status === 'connecting') setConnectionStatus('connecting')
        if (status === 'disconnected') setConnectionStatus('disconnected')
        if (status === 'connected') {
          // Wait for synced before claiming full readiness.
          if (connectionStatus.value !== 'connected') {
            setConnectionStatus('connecting')
          }
        }
      })
      ;(provider as { on: (event: string, fn: () => void) => void }).on(
        'error',
        () => setConnectionStatus('disconnected'),
      )
      provider.on('awarenessUpdate', syncPeers)
      provider.awareness?.on('update', syncPeers)
      provider.awareness?.on('change', syncPeers)
      const clientKey = options.userId || options.userName || 'guest'
      provider.setAwarenessField('user', {
        id: options.userId || `guest:${clientKey}`,
        name: options.userName || '방문자',
        email: options.userEmail,
        color: colorFor(clientKey),
      })
      syncPeers()
    }
  })

  const reconnect = () => {
    if (!provider) return
    setConnectionStatus('connecting')
    try {
      provider.connect()
    } catch {
      setConnectionStatus('disconnected')
    }
  }
  onUnmounted(() => {
    const doc = ydoc.value
    tablesMap(doc).unobserveDeep(onErdMapsChange)
    relationsMap(doc).unobserveDeep(onErdMapsChange)
    notesMap(doc).unobserveDeep(onErdMapsChange)
    domainsMap(doc).unobserveDeep(onErdMapsChange)
    layoutsMap(doc).unobserveDeep(onErdMapsChange)
    schemasMap(doc).unobserveDeep(onErdMapsChange)
    settingsMap(doc).unobserveDeep(onErdMapsChange)
    aclMap(doc).unobserve(syncRoleFromAcl)
    chatArrayUnobserve(doc, onChatChange)
    undoManager?.destroy()
    undoManager = null
    provider?.destroy()
    window.clearTimeout(syncIdleTimer)
    doc.destroy()
  })

  const ensureTablePatch = (id: string) => {
    let handler = tablePatchHandlers.get(id)
    if (!handler) {
      handler = (patch: Partial<ErdTable>) => updateTable(id, patch)
      tablePatchHandlers.set(id, handler)
    }
    return handler
  }

  const ensureAddColumn = (id: string) => {
    let handler = tableAddColumnHandlers.get(id)
    if (!handler) {
      handler = () => addColumn(id)
      tableAddColumnHandlers.set(id, handler)
    }
    return handler
  }

  const ensureNotePatch = (id: string) => {
    let handler = notePatchHandlers.get(id)
    if (!handler) {
      handler = (patch: Partial<ErdNote>) => updateNote(id, patch)
      notePatchHandlers.set(id, handler)
    }
    return handler
  }

  const addTable = (position = { x: 160, y: 160 }) => {
    if (!canEdit()) return
    const schemaId = getSchemaId(ydoc.value) ?? erd.value.schemas[0]?.id
    upsertTable(ydoc.value, defaultTable({ position, schemaId }))
    tool.value = 'select'
  }

  const addNote = (position = { x: 120, y: 120 }) => {
    if (!canEdit()) return
    upsertNote(ydoc.value, defaultNote({ position }))
    tool.value = 'select'
  }

  const updateTable = (id: string, patch: Partial<ErdTable>) => {
    if (!canEdit()) return
    patchTable(ydoc.value, id, patch)
  }

  const addColumn = (tableId: string) => {
    if (!canEdit()) return
    const table =
      getTable(ydoc.value, tableId) ??
      erd.value.tables.find((item) => item.id === tableId)
    if (!table) return
    patchTable(ydoc.value, tableId, {
      columns: [...table.columns, defaultColumn()],
    })
  }

  const updateNote = (id: string, patch: Partial<ErdNote>) => {
    if (!canEdit()) return
    patchNote(ydoc.value, id, patch)
  }

  const addDomain = (domain?: ErdDomain) => {
    if (!canEdit()) return
    upsertDomain(ydoc.value, domain ?? defaultDomain())
  }

  const updateDomain = (domain: ErdDomain) => {
    if (!canEdit()) return
    upsertDomain(ydoc.value, domain)
  }

  const deleteDomainItem = (id: string) => {
    if (!canEdit()) return
    removeDomain(ydoc.value, id)
  }

  const undo = () => {
    if (!canEdit()) return
    undoManager?.undo()
    refreshErd()
    refreshUndo()
  }

  const redo = () => {
    if (!canEdit()) return
    undoManager?.redo()
    refreshErd()
    refreshUndo()
  }

  const beginDrag = (id: string) => {
    draggingIds.add(id)
  }

  const endDrag = (id: string) => {
    draggingIds.delete(id)
  }

  const moveNode = throttleRaf(
    (payload: { id: string; position: { x: number; y: number } }) => {
      if (!canEdit()) return
      const tables = erd.value.tables
      const notes = erd.value.notes
      const table = tables.find((item) => item.id === payload.id)
      if (table) table.position = payload.position
      const note = notes.find((item) => item.id === payload.id)
      if (note) note.position = payload.position
      // Trigger shallow consumers that read erd.value identity for positions via nodes computed
      erd.value = {
        ...erd.value,
        tables: [...tables],
        notes: [...notes],
      }
      patchPosition(ydoc.value, payload.id, payload.position)
    },
  )

  const deleteTable = (id: string) => {
    if (!canEdit()) return
    removeTable(ydoc.value, id)
  }

  const connectTables = (
    sourceTableId: string,
    targetTableId: string,
    sourceColumnId?: string,
    targetColumnId?: string,
    kind: RelationKind = 'non-identifying',
    sourceCardinality: Cardinality = '1',
    targetCardinality: Cardinality = 'N',
  ) => {
    if (!canEdit()) return
    const source =
      getTable(ydoc.value, sourceTableId) ??
      erd.value.tables.find((t) => t.id === sourceTableId)
    const target =
      sourceTableId === targetTableId
        ? source
        : (getTable(ydoc.value, targetTableId) ??
          erd.value.tables.find((t) => t.id === targetTableId))
    if (!source || !target) return
    const planned = planForeignKeyLink(source, target, {
      sourceColumnId,
      targetColumnId,
      kind,
      sourceCardinality,
      targetCardinality,
    })
    if (!planned) return
    upsertTable(ydoc.value, planned.nextTarget)
    upsertRelation(ydoc.value, planned.relation)
  }

  const connectManyToMany = (aId: string, bId: string) => {
    if (!canEdit()) return
    const a =
      getTable(ydoc.value, aId) ?? erd.value.tables.find((t) => t.id === aId)
    const b =
      getTable(ydoc.value, bId) ?? erd.value.tables.find((t) => t.id === bId)
    if (!a || !b) return
    const junction = defaultTable({
      schemaId: a.schemaId,
      logicalName: `${a.logicalName}_${b.logicalName}`,
      physicalName: `${a.physicalName}_${b.physicalName}`,
      position: {
        x: (a.position.x + b.position.x) / 2,
        y: Math.max(a.position.y, b.position.y) + 180,
      },
      columns: [pkColumn()],
    })
    upsertTable(ydoc.value, junction)
    connectTables(a.id, junction.id, undefined, undefined, 'identifying', '1', 'N')
    connectTables(b.id, junction.id, undefined, undefined, 'identifying', '1', 'N')
  }

  const replaceDocument = (next: ErdDocument) => {
    if (!canEdit()) return
    erdToY(ydoc.value, next)
  }

  const updateViewSettings = (patch: ErdViewPatch) => {
    if (!canEdit()) return
    patchViewSettings(ydoc.value, patch)
  }

  const seedFromSnapshot = (next: ErdDocument | null | undefined) => {
    if (!next) return
    seedIfEmpty(ydoc.value, next)
    refreshErd()
    resetUndo()
  }

  const seedRoles = (roles: Record<string, string>, selfRole?: string) => {
    const map = aclMap(ydoc.value)
    if (map.size === 0) {
      ydoc.value.transact(() => {
        for (const [id, role] of Object.entries(roles)) map.set(id, role)
      })
    }
    if (selfRole) myRole.value = selfRole
    syncRoleFromAcl()
  }

  const setAcl = (userId: string, role: string | null) => {
    if (!canEdit()) return
    setAclRole(ydoc.value, userId, role)
    syncRoleFromAcl()
  }

  const sendChat = (body: string) => {
    const text = body.trim()
    if (!text || readOnly.value) return
    pushChat(ydoc.value, {
      userId: options.userId || 'anon',
      name: options.userName || 'Guest',
      email: options.userEmail || '',
      body: text,
    })
  }

  const nodes = computed(() => [
    ...erd.value.tables.map((table) => ({
      id: table.id,
      type: 'table',
      position: table.position,
      data: {
        table,
        readOnly: readOnly.value,
        domains: erd.value.domains,
        onPatch: ensureTablePatch(table.id),
        onAddColumn: ensureAddColumn(table.id),
      },
    })),
    ...erd.value.notes.map((note) => ({
      id: note.id,
      type: 'note',
      position: note.position,
      data: {
        note,
        readOnly: readOnly.value,
        onPatch: ensureNotePatch(note.id),
      },
      connectable: false,
      style: { width: `${note.width}px`, height: `${note.height}px` },
    })),
  ])

  const edges = computed(() => {
    const tables = new Map(
      erd.value.tables.map((table) => [table.id, table] as const),
    )
    return erd.value.relations.map((rel) => {
      const handles = relationHandles(
        tables.get(rel.sourceTableId),
        tables.get(rel.targetTableId),
        rel.sourceColumnIds[0],
        rel.targetColumnIds[0],
      )
      return {
        id: rel.id,
        source: rel.sourceTableId,
        target: rel.targetTableId,
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
        type: 'crow',
        data: rel,
        animated: false,
      }
    })
  })

  return {
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
    addColumn,
    updateTable,
    updateNote,
    addDomain,
    updateDomain,
    removeDomain: deleteDomainItem,
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
    seedRoles,
    setAcl,
    sendChat,
    updateRelation: (relation: ErdRelation) => {
      if (!canEdit()) return
      upsertRelation(ydoc.value, relation)
    },
    removeRelation: (id: string) => {
      if (!canEdit()) return
      removeRelation(ydoc.value, id)
    },
    removeNote: (id: string) => {
      if (!canEdit()) return
      removeNote(ydoc.value, id)
    },
    readOnly,
    myRole,
  }
}

const chatObservers = new WeakMap<Y.Doc, Set<() => void>>()

const chatArrayObserve = (doc: Y.Doc, fn: () => void) => {
  let set = chatObservers.get(doc)
  if (!set) {
    set = new Set()
    chatObservers.set(doc, set)
    const arr = doc.getArray('chat')
    arr.observe(() => {
      chatObservers.get(doc)?.forEach((cb) => cb())
    })
  }
  set.add(fn)
}

const chatArrayUnobserve = (doc: Y.Doc, fn: () => void) => {
  chatObservers.get(doc)?.delete(fn)
}
