import { computed, ref } from 'vue'
import { api } from '@/api'

export type ChatInboxItem = {
  projectId: string
  projectName: string
  teamName: string | null
  body: string
  userName: string
  userId: string
  createdAt: string
  unreadCount: number
}

const seenKey = (userId: string) => `erd_chat_seen_${userId}`

export const readChatSeen = (userId: string): Record<string, number> => {
  try {
    const raw = localStorage.getItem(seenKey(userId))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export const markProjectChatSeen = (userId: string, projectId: string) => {
  const seen = readChatSeen(userId)
  seen[projectId] = Date.now()
  try {
    localStorage.setItem(seenKey(userId), JSON.stringify(seen))
  } catch {
    /* ignore */
  }
}

export const isInboxUnread = (
  item: ChatInboxItem,
  userId?: string,
  seen?: Record<string, number>,
) => {
  if (userId && item.userId === userId) return false
  const at = new Date(item.createdAt).getTime()
  if (!Number.isFinite(at)) return false
  return at > (seen?.[item.projectId] ?? 0)
}

export type ChatNotice = {
  projectId: string
  projectName?: string
  teamName?: string | null
  body?: string
  userName?: string
  userId?: string
  createdAt?: string
}

const items = ref<ChatInboxItem[]>([])
const seen = ref<Record<string, number>>({})
const openChatProject = ref<string | null>(null)

export const setOpenChatProject = (projectId: string | null) => {
  openChatProject.value = projectId
}

export const useChatInbox = (userId: () => string | undefined) => {

  const refreshSeen = () => {
    const id = userId()
    seen.value = id ? readChatSeen(id) : {}
  }

  const load = async (token?: string | null) => {
    refreshSeen()
    if (!token) {
      items.value = []
      return
    }
    const query = new URLSearchParams({ seen: JSON.stringify(seen.value) })
    items.value = await api<ChatInboxItem[]>(
      `/api/chat/inbox?${query}`,
      {},
      token,
    )
  }

  const applyNotice = (notice: ChatNotice, selfId?: string) => {
    if (!notice.projectId || (selfId && notice.userId === selfId)) return true
    const at = notice.createdAt || new Date().toISOString()
    const idx = items.value.findIndex((item) => item.projectId === notice.projectId)
    if (idx < 0) {
      if (!notice.projectName || !notice.body || !notice.userName) return false
      const viewing = openChatProject.value === notice.projectId
      if (viewing && selfId) markProjectChatSeen(selfId, notice.projectId)
      items.value = [
        {
          projectId: notice.projectId,
          projectName: notice.projectName,
          teamName: notice.teamName ?? null,
          body: notice.body,
          userName: notice.userName,
          userId: notice.userId || '',
          createdAt: at,
          unreadCount: viewing ? 0 : 1,
        },
        ...items.value,
      ]
      return true
    }
    const cur = items.value[idx]
    const viewing = openChatProject.value === notice.projectId
    if (viewing && selfId) markProjectChatSeen(selfId, notice.projectId)
    const next: ChatInboxItem = {
      ...cur,
      body: notice.body ?? cur.body,
      userName: notice.userName ?? cur.userName,
      userId: notice.userId ?? cur.userId,
      createdAt: at,
      unreadCount: viewing ? 0 : (cur.unreadCount || 0) + 1,
      projectName: notice.projectName ?? cur.projectName,
      teamName: notice.teamName ?? cur.teamName,
    }
    items.value = [next, ...items.value.filter((_, i) => i !== idx)]
    return true
  }

  const markSeen = (projectId: string) => {
    const id = userId()
    if (!id) return
    markProjectChatSeen(id, projectId)
    refreshSeen()
    items.value = items.value.map((item) =>
      item.projectId === projectId ? { ...item, unreadCount: 0 } : item,
    )
  }

  const unreadItems = computed(() =>
    items.value.filter((item) => (item.unreadCount || 0) > 0),
  )
  const unreadByProject = computed(() => {
    const map = new Map<string, ChatInboxItem>()
    for (const item of unreadItems.value) map.set(item.projectId, item)
    return map
  })

  return { items, seen, load, applyNotice, markSeen, unreadItems, unreadByProject }
}
