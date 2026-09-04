<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { DialogRoot } from 'reka-ui'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'

const props = defineProps<{
  open: boolean
  teamName?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  create: [name: string, fromSample: boolean]
}>()

const name = ref('')

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    name.value = ''
    await nextTick()
    document.querySelector<HTMLInputElement>('[data-create-project-name]')?.focus()
  },
)

const submit = (fromSample: boolean) => {
  emit('create', name.value.trim() || '새 다이어그램', fromSample)
  emit('update:open', false)
}
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <template #header>
        <DialogTitle>프로젝트 만들기</DialogTitle>
        <p class="mt-2 text-[15px] text-muted-foreground">
          {{
            teamName
              ? `${teamName}에 새 다이어그램을 만들어요`
              : '새 다이어그램 이름을 적어 주세요'
          }}
        </p>
      </template>
      <form class="space-y-5" @submit.prevent="submit(false)">
        <div class="space-y-2">
          <Label for="create-project-name">이름</Label>
          <Input
            id="create-project-name"
            v-model="name"
            data-create-project-name
            placeholder="예: 주문 ERD"
            autocomplete="off"
          />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            class="h-12"
            @click="submit(true)"
          >
            샘플로 시작
          </Button>
          <Button type="submit" class="h-12">만들기</Button>
        </div>
      </form>
    </DialogContent>
  </DialogRoot>
</template>
