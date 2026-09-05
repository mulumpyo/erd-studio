import { ref } from 'vue'
import type { ReceivedInvite } from '@/composables/useNotifications'

export type InviteToastAnchor = {
  open: boolean
  top?: number
  left: number
  width: number
}

const toasts = ref<ReceivedInvite[]>([])
const inboxOpen = ref(false)
const toastAnchor = ref<InviteToastAnchor | null>(null)
let refreshInbox: (() => void) | null = null

export const setInviteToastAnchor = (anchor: InviteToastAnchor | null) => {
  toastAnchor.value = anchor
  inboxOpen.value = Boolean(anchor?.open)
}

export const bindInviteInboxRefresh = (fn: (() => void) | null) => {
  refreshInbox = fn
}

export const pushInviteToasts = (incoming: ReceivedInvite[]) => {
  if (!incoming.length) return
  const have = new Set(toasts.value.map((item) => item.id))
  const next = incoming.filter((item) => !have.has(item.id))
  if (!next.length) return
  toasts.value = [...next, ...toasts.value]
}

export const dismissInviteToast = (id: string) => {
  toasts.value = toasts.value.filter((item) => item.id !== id)
}

export const syncInviteToasts = (invites: ReceivedInvite[]) => {
  const have = new Set(invites.map((item) => item.id))
  toasts.value = toasts.value.filter((item) => have.has(item.id))
}

export const useInviteToasts = () => ({
  toasts,
  inboxOpen,
  toastAnchor,
  dismissInviteToast,
  refreshInbox: () => refreshInbox?.(),
})
