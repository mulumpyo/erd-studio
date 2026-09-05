<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { X } from 'lucide-vue-next'
import { api } from '@/api'
import { errorMessage } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import {
  inviteLocation,
  inviteNoticeText,
  isIncomingInvite,
  type ReceivedInvite,
} from '@/composables/useNotifications'
import { dismissInviteToast, useInviteToasts } from '@/composables/useInviteToasts'
import Button from '@/components/ui/button/Button.vue'

const { toasts, toastAnchor, inboxOpen, refreshInbox } = useInviteToasts()
const compact = useMediaQuery('(max-width: 767px)')
const hideToasts = computed(() => Boolean(compact.value && inboxOpen.value))

const stackStyle = computed(() => {
  if (hideToasts.value) return undefined
  if (compact.value) {
    return {
      left: 'auto',
      right: '16px',
      width: 'min(22rem, calc(100vw - 5.5rem))',
      top: 'calc(var(--erd-inset-top, 5.25rem) + 12px)',
    }
  }
  const anchor = toastAnchor.value
  if (!anchor) return undefined
  return {
    left: `${anchor.left}px`,
    width: `${anchor.width}px`,
    right: 'auto',
    ...(anchor.open && anchor.top ? { top: `${anchor.top}px` } : {}),
  }
})
const auth = useAuthStore()
const router = useRouter()
const busyId = ref<string | null>(null)
const error = ref('')

const dismissNotice = async (invite: ReceivedInvite) => {
  if (invite.type === 'declined' || invite.type === 'accepted') {
    busyId.value = invite.id
    try {
      await api(
        `/api/invites/sent/${invite.id}/dismiss`,
        { method: 'POST' },
        auth.token,
      )
    } catch (e) {
      error.value = errorMessage(e, '알림을 닫지 못했어요')
      busyId.value = null
      return
    }
    busyId.value = null
  }
  dismissInviteToast(invite.id)
  refreshInbox()
  if (invite.type === 'accepted') await router.push(inviteLocation(invite))
}

const accept = async (invite: ReceivedInvite) => {
  busyId.value = invite.id
  try {
    await api(
      `/api/invites/received/${invite.id}/accept`,
      { method: 'POST' },
      auth.token,
    )
    dismissInviteToast(invite.id)
    refreshInbox()
    await router.push(inviteLocation(invite))
  } catch (e) {
    error.value = errorMessage(e, '초대를 수락하지 못했어요')
  } finally {
    busyId.value = null
  }
}

const decline = async (invite: ReceivedInvite) => {
  busyId.value = invite.id
  try {
    await api(
      `/api/invites/received/${invite.id}/decline`,
      { method: 'POST' },
      auth.token,
    )
    dismissInviteToast(invite.id)
    refreshInbox()
  } catch (e) {
    error.value = errorMessage(e, '초대를 거절하지 못했어요')
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-show="!hideToasts"
      class="pointer-events-none fixed right-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 transition-[top,left,width] duration-200 ease-out md:z-[100]"
      :class="
        toastAnchor?.open && toastAnchor.top
          ? ''
          : 'top-[calc(var(--vv-chrome-gap,0px)+env(safe-area-inset-top)+5.25rem)]'
      "
      :style="stackStyle"
    >
      <p v-if="error" class="pointer-events-auto text-sm text-destructive">
        {{ error }}
      </p>
      <TransitionGroup name="invite-toast">
        <article
          v-for="invite in toasts"
          :key="invite.id"
          class="pointer-events-auto rounded-2xl bg-card p-4 shadow-[0_16px_48px_rgb(25_31_40_/_0.18)]"
        >
          <div class="flex items-start gap-2">
            <div class="min-w-0 flex-1">
              <p class="truncate text-[15px] font-semibold tracking-[-0.02em]">
                {{ invite.workspaceName }}
              </p>
              <p class="mt-0.5 truncate text-[13px] text-muted-foreground">
                {{ inviteNoticeText(invite) }}
              </p>
            </div>
            <button
              type="button"
              class="flex size-8 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="알림 닫기"
              @click="dismissNotice(invite)"
            >
              <X class="size-4" />
            </button>
          </div>
          <div v-if="isIncomingInvite(invite)" class="mt-3 flex gap-2">
            <Button
              variant="secondary"
              class="h-9 flex-1 px-3"
              :disabled="busyId === invite.id"
              @click="decline(invite)"
            >
              거절
            </Button>
            <Button
              class="h-9 flex-1 px-3"
              :disabled="busyId === invite.id"
              @click="accept(invite)"
            >
              수락
            </Button>
          </div>
          <Button
            v-else
            class="mt-3 h-9 w-full px-3"
            :disabled="busyId === invite.id"
            @click="dismissNotice(invite)"
          >
            확인
          </Button>
        </article>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
