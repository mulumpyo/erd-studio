import { computed, ref } from 'vue'
import { api } from '@/api'
import { apiOrigin } from '@/lib/urls'

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

export const useChatInbox = (userId: () => string | undefined) => {
  const items = ref<ChatInboxItem[]>([])
  const seen = ref<Record<string, number>>({})
  let source: EventSource | null = null
  let reloadTimer = 0

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

  const stop = () => {
    window.clearTimeout(reloadTimer)
    source?.close()
    source = null
  }

  const listen = (token?: string | null) => {
    stop()
    if (!token) return
    const es = new EventSource(`${apiOrigin()}/api/chat/inbox/stream`, {
      withCredentials: true,
    })
    es.addEventListener('inbox', () => {
      window.clearTimeout(reloadTimer)
      reloadTimer = window.setTimeout(() => {
        void load(token)
      }, 200)
    })
    source = es
  }

  return { items, seen, load, markSeen, unreadItems, unreadByProject, listen, stop }
}
