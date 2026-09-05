<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { Bell } from 'lucide-vue-next'
import { api } from '@/api'
import type { ChatInboxItem } from '@/composables/useChatInbox'
import {
  inviteNoticeText,
  isIncomingInvite,
  type ReceivedInvite,
} from '@/composables/useNotifications'
import { dismissInviteToast, setInviteToastAnchor } from '@/composables/useInviteToasts'
import { formatChatDate, formatChatTime, errorMessage } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import Button from '@/components/ui/button/Button.vue'

const props = defineProps<{
  chats: ChatInboxItem[]
  invites: ReceivedInvite[]
}>()

const emit = defineEmits<{
  open: [projectId: string]
  accepted: [invite: ReceivedInvite]
  changed: []
}>()

const auth = useAuthStore()
const open = ref(false)
const compact = useMediaQuery('(max-width: 767px)')
const busyId = ref<string | null>(null)
const error = ref('')

const unreadChats = computed(() =>
  props.chats.reduce((sum, item) => sum + (item.unreadCount || 0), 0),
)
const unreadTotal = computed(() => unreadChats.value + props.invites.length)
const empty = computed(() => !props.chats.length && !props.invites.length)

const badge = (count: number) => (count > 99 ? '99+' : String(count))

const stamp = (iso: string) => {
  const at = new Date(iso).getTime()
  if (!Number.isFinite(at)) return ''
  return `${formatChatDate(at)} ${formatChatTime(at)}`
}

const openItem = (projectId: string) => {
  open.value = false
  emit('open', projectId)
}

const accept = async (invite: ReceivedInvite) => {
  busyId.value = invite.id
  error.value = ''
  try {
    await api(`/api/invites/received/${invite.id}/accept`, { method: 'POST' }, auth.token)
    dismissInviteToast(invite.id)
    open.value = false
    emit('accepted', invite)
    emit('changed')
  } catch (e) {
    error.value = errorMessage(e, '초대를 수락하지 못했어요')
  } finally {
    busyId.value = null
  }
}

const dismiss = async (invite: ReceivedInvite) => {
  busyId.value = invite.id
  error.value = ''
  try {
    await api(`/api/invites/sent/${invite.id}/dismiss`, { method: 'POST' }, auth.token)
    dismissInviteToast(invite.id)
    emit('changed')
    if (invite.type === 'accepted') {
      open.value = false
      emit('accepted', invite)
    }
  } catch (e) {
    error.value = errorMessage(e, '알림을 닫지 못했어요')
  } finally {
    busyId.value = null
  }
}

const decline = async (invite: ReceivedInvite) => {
  busyId.value = invite.id
  error.value = ''
  try {
    await api(`/api/invites/received/${invite.id}/decline`, { method: 'POST' }, auth.token)
    dismissInviteToast(invite.id)
    emit('changed')
  } catch (e) {
    error.value = errorMessage(e, '초대를 거절하지 못했어요')
  } finally {
    busyId.value = null
  }
}

const INBOX_GAP = 8
const PANEL_WIDTH = 352

let inboxResize: ResizeObserver | null = null
let inboxFrame = 0

const panelWidth = () => Math.min(PANEL_WIDTH, window.innerWidth - 32)

const applyInboxAnchor = () => {
  const inbox = document.querySelector<HTMLElement>('[data-invite-inbox]')
  const bell = document.querySelector<HTMLElement>('[data-invite-bell]')
  if (open.value && compact.value) {
    setInviteToastAnchor({ open: true, left: 0, width: 0 })
    return
  }
  if (open.value && inbox) {
    const box = inbox.getBoundingClientRect()
    setInviteToastAnchor({
      open: true,
      top: Math.round(box.bottom + INBOX_GAP),
      left: Math.round(box.left),
      width: Math.round(box.width),
    })
    return
  }
  if (bell && !compact.value) {
    const box = bell.getBoundingClientRect()
    const width = panelWidth()
    setInviteToastAnchor({
      open: false,
      left: Math.round(Math.max(16, box.right - width)),
      width,
    })
    return
  }
  setInviteToastAnchor(null)
}

const stopInboxSync = () => {
  cancelAnimationFrame(inboxFrame)
  inboxResize?.disconnect()
  inboxResize = null
}

const syncInboxAnchor = () => {
  stopInboxSync()
  const attach = () => {
    applyInboxAnchor()
    const el =
      document.querySelector<HTMLElement>('[data-invite-inbox]') ||
      document.querySelector<HTMLElement>('[data-invite-bell]')
    if (el && !inboxResize) {
      inboxResize = new ResizeObserver(applyInboxAnchor)
      inboxResize.observe(el)
      return
    }
    if (open.value && !el) inboxFrame = requestAnimationFrame(attach)
  }
  void nextTick(() => {
    inboxFrame = requestAnimationFrame(attach)
  })
}

watch([open, compact], syncInboxAnchor)

onMounted(() => {
  window.addEventListener('resize', applyInboxAnchor)
  syncInboxAnchor()
})

onUnmounted(() => {
  window.removeEventListener('resize', applyInboxAnchor)
  stopInboxSync()
  setInviteToastAnchor(null)
})
</script>

<template>
  <DialogRoot v-if="compact" :open="open" @update:open="open = $event">
    <button
      type="button"
      data-invite-bell
      class="relative flex size-11 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      :aria-label="
        unreadTotal ? `읽지 않은 알림 ${unreadTotal}개` : '알림'
      "
      :aria-expanded="open"
      @click="open = true"
    >
      <Bell class="size-4" />
      <span
        v-if="unreadTotal"
        class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-white"
      >
        {{ badge(unreadTotal) }}
      </span>
    </button>
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-[60] bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <DialogContent
        data-invite-inbox
        class="fixed left-1/2 top-1/2 z-[70] w-[min(22rem,calc(100vw-2rem))] min-w-[min(22rem,calc(100vw-2rem))] max-h-[min(70dvh,28rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-0 bg-card p-1.5 shadow-[0_16px_48px_rgb(25_31_40_/_0.18)] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
      >
        <DialogTitle
          class="px-3 py-2 text-[15px] font-semibold tracking-[-0.02em]"
        >
          알림
        </DialogTitle>
        <div class="max-h-[min(58dvh,22rem)] overflow-y-auto">
          <p
            v-if="empty"
            class="px-3 py-6 text-center text-[13px] text-muted-foreground"
          >
            아직 받은 알림이 없어요.
          </p>
          <p v-else-if="error" class="px-3 pb-2 text-sm text-destructive">
            {{ error }}
          </p>
          <div
            v-for="invite in invites"
            :key="invite.id"
            class="flex flex-col gap-2 rounded-[10px] px-3 py-2.5"
          >
            <div class="min-w-0">
              <p class="truncate text-[14px] font-semibold">
                {{ invite.workspaceName }}
              </p>
              <p class="mt-0.5 truncate text-[13px] text-muted-foreground">
                {{ inviteNoticeText(invite) }}
              </p>
            </div>
            <div v-if="isIncomingInvite(invite)" class="flex gap-2">
              <Button
                variant="secondary"
                class="h-8 flex-1 px-3"
                :disabled="busyId === invite.id"
                @click="decline(invite)"
              >
                거절
              </Button>
              <Button
                class="h-8 flex-1 px-3"
                :disabled="busyId === invite.id"
                @click="accept(invite)"
              >
                수락
              </Button>
            </div>
            <Button
              v-else
              variant="secondary"
              class="h-8 px-3"
              :disabled="busyId === invite.id"
              @click="dismiss(invite)"
            >
              확인
            </Button>
          </div>
          <button
            v-for="item in chats"
            :key="item.projectId"
            type="button"
            class="flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-[10px] px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted focus:bg-muted"
            @click="openItem(item.projectId)"
          >
            <span class="flex w-full min-w-0 items-center gap-2">
              <span
                class="min-w-0 truncate text-[14px] font-semibold"
                :class="
                  item.unreadCount
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                "
              >
                {{
                  item.teamName
                    ? `${item.teamName} · ${item.projectName}`
                    : item.projectName
                }}
              </span>
              <span
                v-if="item.unreadCount"
                class="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold leading-none text-white"
              >
                {{ badge(item.unreadCount) }}
              </span>
            </span>
            <span class="w-full truncate text-[13px] text-muted-foreground">
              {{ item.userName }}: {{ item.body }}
            </span>
            <span class="text-[12px] text-muted-foreground">{{
              stamp(item.createdAt)
            }}</span>
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
  <DropdownMenuRoot v-else v-model:open="open">
    <DropdownMenuTrigger
      data-invite-bell
      class="relative flex size-11 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      :aria-label="
        unreadTotal ? `읽지 않은 알림 ${unreadTotal}개` : '알림'
      "
    >
      <Bell class="size-4" />
      <span
        v-if="unreadTotal"
        class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-white"
      >
        {{ badge(unreadTotal) }}
      </span>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        data-invite-inbox
        align="end"
        :side-offset="6"
        class="z-[60] w-[min(22rem,calc(100vw-2rem))] min-w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border-0 bg-card p-1.5 shadow-[0_12px_32px_rgb(25_31_40_/_0.14)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      >
        <p class="px-3 py-2 text-[13px] font-semibold tracking-[-0.02em]">
          알림
        </p>
        <p
          v-if="empty"
          class="px-3 py-6 text-center text-[13px] text-muted-foreground"
        >
          아직 받은 알림이 없어요.
        </p>
        <p v-else-if="error" class="px-3 pb-2 text-sm text-destructive">
          {{ error }}
        </p>
        <div
          v-for="invite in invites"
          :key="invite.id"
          class="flex flex-col gap-2 rounded-[10px] px-3 py-2.5"
        >
          <div class="min-w-0">
            <p class="truncate text-[14px] font-semibold">
              {{ invite.workspaceName }}
            </p>
            <p class="mt-0.5 truncate text-[13px] text-muted-foreground">
              {{ inviteNoticeText(invite) }}
            </p>
          </div>
          <div v-if="isIncomingInvite(invite)" class="flex gap-2" @pointerdown.stop>
            <Button
              variant="secondary"
              class="h-8 flex-1 px-3"
              :disabled="busyId === invite.id"
              @click="decline(invite)"
            >
              거절
            </Button>
            <Button
              class="h-8 flex-1 px-3"
              :disabled="busyId === invite.id"
              @click="accept(invite)"
            >
              수락
            </Button>
          </div>
          <div v-else @pointerdown.stop>
            <Button
              variant="secondary"
              class="h-8 px-3"
              :disabled="busyId === invite.id"
              @click="dismiss(invite)"
            >
              확인
            </Button>
          </div>
        </div>
        <DropdownMenuItem
          v-for="item in chats"
          :key="item.projectId"
          class="flex cursor-pointer flex-col items-start gap-0.5 rounded-[10px] px-3 py-2.5 outline-none transition-colors hover:bg-muted focus:bg-muted"
          @select="emit('open', item.projectId)"
        >
          <span class="flex w-full min-w-0 items-center gap-2">
            <span
              class="min-w-0 truncate text-[14px] font-semibold"
              :class="
                item.unreadCount
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              "
            >
              {{ item.teamName ? `${item.teamName} · ${item.projectName}` : item.projectName }}
            </span>
            <span
              v-if="item.unreadCount"
              class="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold leading-none text-white"
            >
              {{ badge(item.unreadCount) }}
            </span>
          </span>
          <span class="w-full truncate text-[13px] text-muted-foreground">
            {{ item.userName }}: {{ item.body }}
          </span>
          <span class="text-[12px] text-muted-foreground">{{
            stamp(item.createdAt)
          }}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
