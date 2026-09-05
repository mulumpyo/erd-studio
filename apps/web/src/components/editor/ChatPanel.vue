<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { ChatLine } from '@erd-studio/yjs-erd'
import {
  formatChatDate,
  formatChatTime,
  sameLocalDay,
} from '@/lib/format'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'

const props = defineProps<{ messages: ChatLine[]; readOnly?: boolean }>()
const emit = defineEmits<{ (e: 'send', body: string): void }>()
const body = ref('')
const scroller = ref<HTMLElement | null>(null)

type ChatItem =
  | { kind: 'date'; id: string; label: string }
  | { kind: 'message'; message: ChatLine }

const items = computed<ChatItem[]>(() => {
  const out: ChatItem[] = []
  let lastDay: number | null = null
  for (const message of props.messages) {
    const at = Number(message.createdAt)
    if (!Number.isFinite(at)) {
      out.push({ kind: 'message', message })
      continue
    }
    if (lastDay === null || !sameLocalDay(lastDay, at)) {
      out.push({
        kind: 'date',
        id: `day-${at}`,
        label: formatChatDate(at),
      })
      lastDay = at
    }
    out.push({ kind: 'message', message })
  }
  return out
})

const send = () => {
  if (props.readOnly) return
  emit('send', body.value)
  body.value = ''
}

const scrollToEnd = async () => {
  await nextTick()
  if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
}

onMounted(scrollToEnd)
watch(() => props.messages.length, scrollToEnd)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3">
    <div ref="scroller" class="min-h-0 flex-1 space-y-2 overflow-auto">
      <div v-if="!messages.length" class="text-sm text-muted-foreground">
        아직 메시지가 없어요. 입력하면 바로 공유돼요.
      </div>
      <template v-for="item in items" :key="item.kind === 'date' ? item.id : item.message.id">
        <div
          v-if="item.kind === 'date'"
          class="flex items-center gap-3 py-2"
        >
          <div class="h-px flex-1 bg-border" />
          <span class="shrink-0 text-[12px] text-muted-foreground">{{
            item.label
          }}</span>
          <div class="h-px flex-1 bg-border" />
        </div>
        <div v-else class="rounded-2xl bg-muted px-3.5 py-2.5">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate text-[12px] font-bold text-muted-foreground">
                {{ item.message.name }}
              </div>
              <div
                v-if="item.message.email"
                class="truncate text-[11px] text-muted-foreground"
              >
                {{ item.message.email }}
              </div>
            </div>
            <div class="shrink-0 pt-0.5 text-[11px] text-muted-foreground">
              {{ formatChatTime(item.message.createdAt) }}
            </div>
          </div>
          <div class="text-[15px] tracking-[-0.01em]">{{ item.message.body }}</div>
        </div>
      </template>
    </div>
    <form class="flex shrink-0 items-stretch gap-2" @submit.prevent="send">
      <Input v-model="body" :disabled="readOnly" placeholder="메시지 보내기" />
      <Button type="submit" class="h-12 shrink-0 px-5" :disabled="readOnly"
        >전송</Button
      >
    </form>
  </div>
</template>
