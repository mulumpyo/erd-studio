import { computed, ref } from 'vue'
import { api } from '@/api'
import { apiOrigin } from '@/lib/urls'
import { useChatInbox } from '@/composables/useChatInbox'
import {
  bindInviteInboxRefresh,
  pushInviteToasts,
  syncInviteToasts,
} from '@/composables/useInviteToasts'

export type ReceivedInvite = {
  id: string
  type?: 'incoming' | 'declined' | 'accepted'
  kind: 'team' | 'project'
  role: string
  workspaceName: string
  inviterName: string
  inviterEmail?: string | null
  inviteeName?: string | null
  inviteeEmail?: string | null
  expiresAt: string
  projectId: string | null
  teamId: string | null
}

export type NotifyListEvent = {
  type: string
  teamId?: string
  projectId?: string
}

export const isIncomingInvite = (invite: ReceivedInvite) =>
  invite.type !== 'declined' && invite.type !== 'accepted'

export const personLine = (name?: string | null, email?: string | null) => {
  const n = name?.trim()
  const e = email?.trim()
  if (n && e && n !== e) return `${n} · ${e}`
  return n || e || '상대'
}

export const inviteLocation = (invite: {
  kind?: string
  projectId?: string | null
  teamId?: string | null
}) => {
  if (invite.kind === 'project' && invite.projectId) {
    return { name: 'editor' as const, params: { id: invite.projectId } }
  }
  if (invite.teamId) {
    return { name: 'team' as const, params: { teamId: invite.teamId } }
  }
  if (invite.projectId) {
    return { name: 'editor' as const, params: { id: invite.projectId } }
  }
  return { name: 'dashboard' as const }
}

export const inviteNoticeText = (invite: ReceivedInvite) => {
  const place = invite.kind === 'team' ? '팀' : '프로젝트'
  if (invite.type === 'declined' || invite.type === 'accepted') {
    const who = personLine(invite.inviteeName, invite.inviteeEmail)
    return invite.type === 'declined'
      ? `${who}님이 ${place} 초대를 거절했어요`
      : `${who}님이 ${place} 초대를 수락했어요`
  }
  return `${personLine(invite.inviterName, invite.inviterEmail)}님이 ${place}에 초대했어요 · ${invite.role === 'viewer' ? '보기' : '편집'}`
}

const invites = ref<ReceivedInvite[]>([])
const listHandlers = new Set<(event?: NotifyListEvent) => void>()
let source: EventSource | null = null
let reloadTimer = 0
let currentToken: string | null = null

export const onNotifyListsChange = (fn: (event?: NotifyListEvent) => void) => {
  listHandlers.add(fn)
  return () => {
    listHandlers.delete(fn)
  }
}

const emitListsChange = (event?: NotifyListEvent) => {
  for (const fn of listHandlers) fn(event)
}

export const useNotifications = (userId: () => string | undefined) => {
  const chat = useChatInbox(userId)

  const loadInvites = async (token?: string | null) => {
    if (!token) {
      invites.value = []
      syncInviteToasts([])
      return
    }
    try {
      invites.value = await api<ReceivedInvite[]>('/api/invites', {}, token)
    } catch {
      return
    }
    syncInviteToasts(invites.value)
  }

  const load = async (
    token?: string | null,
    opts?: { announce?: boolean; lists?: boolean },
  ) => {
    const prev = new Set(invites.value.map((item) => item.id))
    await Promise.all([chat.load(token), loadInvites(token)])
    if (opts?.announce) {
      pushInviteToasts(invites.value.filter((item) => !prev.has(item.id)))
    }
    if (opts?.lists) emitListsChange()
    if (token) {
      bindInviteInboxRefresh(() => {
        void load(token)
      })
    }
  }

  const stop = () => {
    window.clearTimeout(reloadTimer)
    source?.close()
    source = null
    currentToken = null
    bindInviteInboxRefresh(null)
  }

  const listen = (token?: string | null) => {
    if (!token) {
      stop()
      return
    }
    if (source && currentToken === token) return
    stop()
    currentToken = token
    bindInviteInboxRefresh(() => {
      void load(token, { lists: true })
    })
    const es = new EventSource(`${apiOrigin()}/api/notify/stream`, {
      withCredentials: true,
    })
    const onEvent = (ev: Event) => {
      let type = ''
      let teamId = ''
      let projectId = ''
      let notice: {
        projectId?: string
        projectName?: string
        teamName?: string | null
        body?: string
        userName?: string
        createdAt?: string
      } = {}
      const data = (ev as MessageEvent).data
      if (typeof data === 'string' && data) {
        try {
          const parsed = JSON.parse(data) as {
            type?: string
            teamId?: string
            projectId?: string
            projectName?: string
            teamName?: string | null
            body?: string
            userName?: string
            createdAt?: string
          }
          type = String(parsed.type ?? '')
          teamId = typeof parsed.teamId === 'string' ? parsed.teamId : ''
          projectId = typeof parsed.projectId === 'string' ? parsed.projectId : ''
          notice = parsed
        } catch {
          type = ''
        }
      }
      if (type === 'chat') {
        if (
          !chat.applyNotice(
            {
              projectId,
              projectName: notice.projectName,
              teamName: notice.teamName,
              body: notice.body,
              userName: notice.userName,
              createdAt: notice.createdAt,
            },
            userId(),
          )
        ) {
          void chat.load(token)
        }
        return
      }
      window.clearTimeout(reloadTimer)
      reloadTimer = window.setTimeout(() => {
        if (type === 'team' || type === 'project') {
          emitListsChange({
            type,
            teamId: teamId || undefined,
            projectId: projectId || undefined,
          })
          return
        }
        const prev = new Set(invites.value.map((item) => item.id))
        void loadInvites(token).then(() => {
          if (
            type === 'invite' ||
            type === 'invite-declined' ||
            type === 'invite-accepted'
          ) {
            pushInviteToasts(invites.value.filter((item) => !prev.has(item.id)))
            emitListsChange({ type })
          }
        })
      }, 200)
    }
    es.addEventListener('notify', onEvent)
    es.addEventListener('inbox', onEvent)
    es.onmessage = onEvent
    source = es
  }

  const unreadCount = computed(
    () =>
      chat.unreadItems.value.reduce((sum, item) => sum + (item.unreadCount || 0), 0) +
      invites.value.length,
  )

  return {
    chats: chat.items,
    invites,
    unreadByProject: chat.unreadByProject,
    unreadCount,
    load,
    markSeen: chat.markSeen,
    listen,
    stop,
  }
}
