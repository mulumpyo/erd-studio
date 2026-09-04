<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { DialogRoot } from 'reka-ui'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import SegmentedControl from '@/components/ui/segmented-control/SegmentedControl.vue'

const props = defineProps<{
  open: boolean
  busy?: boolean
  error?: string
  teamName?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  invite: [email: string, role: string]
}>()

const email = ref('')
const role = ref('editor')

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    email.value = ''
    role.value = 'editor'
    await nextTick()
    document.querySelector<HTMLInputElement>('[data-invite-member-email]')?.focus()
  },
)

const submit = () => {
  const next = email.value.trim()
  if (!next || props.busy) return
  emit('invite', next, role.value)
}
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <template #header>
        <DialogTitle>팀원 초대</DialogTitle>
        <p class="mt-2 text-[15px] text-muted-foreground">
          {{
            teamName
              ? `${teamName}에 초대할 이메일과 역할을 정해 주세요`
              : '초대할 이메일과 역할을 정해 주세요'
          }}
        </p>
      </template>
      <form class="space-y-5" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="invite-member-email">이메일</Label>
          <Input
            id="invite-member-email"
            v-model="email"
            type="email"
            data-invite-member-email
            placeholder="예: kim@example.com"
            autocomplete="off"
            required
          />
        </div>
        <div class="space-y-2">
          <Label>역할</Label>
          <SegmentedControl
            v-model="role"
            class="h-12 w-full"
            :options="[
              { value: 'editor', label: '편집' },
              { value: 'viewer', label: '보기' },
            ]"
          />
        </div>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <Button
          type="submit"
          class="h-12 w-full"
          :disabled="busy || !email.trim()"
        >
          초대
        </Button>
      </form>
    </DialogContent>
  </DialogRoot>
</template>
