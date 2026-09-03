<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import type { ChatLine } from '@erd-studio/yjs-erd'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'

const props = defineProps<{ messages: ChatLine[]; readOnly?: boolean }>()
const emit = defineEmits<{ (e: 'send', body: string): void }>()
const body = ref('')
const scroller = ref<HTMLElement | null>(null)

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
  <div class="flex h-full min-h-0 flex-col gap-3">
    <div ref="scroller" class="min-h-0 flex-1 space-y-2 overflow-auto">
      <div v-if="!messages.length" class="text-sm text-muted-foreground">
        아직 메시지가 없어요. 입력하면 바로 공유돼요.
      </div>
      <div
        v-for="m in messages"
        :key="m.id"
        class="rounded-2xl bg-muted px-3.5 py-2.5"
      >
        <div class="text-[12px] font-bold text-muted-foreground">{{ m.name }}</div>
        <div class="text-[15px] tracking-[-0.01em]">{{ m.body }}</div>
      </div>
    </div>
    <form class="flex items-stretch gap-2" @submit.prevent="send">
      <Input v-model="body" :disabled="readOnly" placeholder="메시지 보내기" />
      <Button type="submit" class="h-12 shrink-0 px-5" :disabled="readOnly"
        >전송</Button
      >
    </form>
  </div>
</template>
