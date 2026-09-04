<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { DialogRoot } from 'reka-ui'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    description?: string
    confirmLabel?: string
    initialName?: string
  }>(),
  {
    title: '팀 만들기',
    description: '같이 그릴 팀 이름을 정해 주세요',
    confirmLabel: '만들기',
    initialName: '',
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  create: [name: string]
}>()

const name = ref('')

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    name.value = props.initialName
    await nextTick()
    document.querySelector<HTMLInputElement>('[data-create-team-name]')?.focus()
  },
)

const submit = () => {
  const next = name.value.trim()
  if (!next) return
  emit('create', next)
  emit('update:open', false)
}
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <template #header>
        <DialogTitle>{{ title }}</DialogTitle>
        <p class="mt-2 text-[15px] text-muted-foreground">
          {{ description }}
        </p>
      </template>
      <form class="space-y-5" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="create-team-name">이름</Label>
          <Input
            id="create-team-name"
            v-model="name"
            data-create-team-name
            maxlength="80"
            placeholder="예: 결제 스쿼드"
            autocomplete="off"
          />
        </div>
        <Button type="submit" class="h-12 w-full" :disabled="!name.trim()">
          {{ confirmLabel }}
        </Button>
      </form>
    </DialogContent>
  </DialogRoot>
</template>
