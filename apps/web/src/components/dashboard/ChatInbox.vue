<script setup lang="ts">
import { computed, ref } from 'vue'
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
import { MessageCircle } from 'lucide-vue-next'
import type { ChatInboxItem } from '@/composables/useChatInbox'
import { formatChatDate, formatChatTime } from '@/lib/format'

const props = defineProps<{
  items: ChatInboxItem[]
}>()

const emit = defineEmits<{
  open: [projectId: string]
}>()

const open = ref(false)
const compact = useMediaQuery('(max-width: 767px)')

const unreadTotal = computed(() =>
  props.items.reduce((sum, item) => sum + (item.unreadCount || 0), 0),
)

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
</script>

<template>
  <DialogRoot v-if="compact" :open="open" @update:open="open = $event">
    <button
      type="button"
      class="relative flex size-11 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      :aria-label="
        unreadTotal ? `읽지 않은 채팅 ${unreadTotal}개` : '채팅 알림'
      "
      :aria-expanded="open"
      @click="open = true"
    >
      <MessageCircle class="size-4" />
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
        class="fixed left-1/2 top-1/2 z-[70] w-[min(22rem,calc(100vw-2rem))] max-h-[min(70dvh,28rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border-0 bg-card p-1.5 shadow-[0_16px_48px_rgb(25_31_40_/_0.18)] focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
      >
        <DialogTitle
          class="px-3 py-2 text-[15px] font-semibold tracking-[-0.02em]"
        >
          채팅
        </DialogTitle>
        <div class="max-h-[min(58dvh,22rem)] overflow-y-auto">
          <p
            v-if="!items.length"
            class="px-3 py-6 text-center text-[13px] text-muted-foreground"
          >
            아직 받은 채팅이 없어요.
          </p>
          <button
            v-for="item in items"
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
  <DropdownMenuRoot v-else>
    <DropdownMenuTrigger
      class="relative flex size-11 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      :aria-label="
        unreadTotal ? `읽지 않은 채팅 ${unreadTotal}개` : '채팅 알림'
      "
    >
      <MessageCircle class="size-4" />
      <span
        v-if="unreadTotal"
        class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-white"
      >
        {{ badge(unreadTotal) }}
      </span>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="6"
        class="z-[60] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border-0 bg-card p-1.5 shadow-[0_12px_32px_rgb(25_31_40_/_0.14)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      >
        <p class="px-3 py-2 text-[13px] font-semibold tracking-[-0.02em]">
          채팅
        </p>
        <p
          v-if="!items.length"
          class="px-3 py-6 text-center text-[13px] text-muted-foreground"
        >
          아직 받은 채팅이 없어요.
        </p>
        <DropdownMenuItem
          v-for="item in items"
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
