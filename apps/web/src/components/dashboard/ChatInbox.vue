<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui'
import { MessageCircle } from 'lucide-vue-next'
import type { ChatInboxItem } from '@/composables/useChatInbox'
import { formatChatDate, formatChatTime } from '@/lib/format'

defineProps<{
  items: ChatInboxItem[]
  unreadIds: Set<string>
}>()

const emit = defineEmits<{
  open: [projectId: string]
}>()

const stamp = (iso: string) => {
  const at = new Date(iso).getTime()
  if (!Number.isFinite(at)) return ''
  return `${formatChatDate(at)} ${formatChatTime(at)}`
}
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      class="relative flex size-11 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      :aria-label="
        unreadIds.size
          ? `채팅 알림 ${unreadIds.size}개`
          : '채팅 알림'
      "
    >
      <MessageCircle class="size-4" />
      <span
        v-if="unreadIds.size"
        class="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary"
      />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="6"
        class="z-[60] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border-0 bg-card p-1.5 shadow-[0_8px_32px_rgb(25_31_40_/_0.14)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
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
              class="truncate text-[14px] font-semibold"
              :class="unreadIds.has(item.projectId) ? 'text-foreground' : 'text-muted-foreground'"
            >
              {{ item.teamName ? `${item.teamName} · ${item.projectName}` : item.projectName }}
            </span>
            <span
              v-if="unreadIds.has(item.projectId)"
              class="ml-auto size-2 shrink-0 rounded-full bg-primary"
            />
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
