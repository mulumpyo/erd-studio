<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DialogRoot } from 'reka-ui'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import Button from '@/components/ui/button/Button.vue'
import Label from '@/components/ui/label/Label.vue'
import SegmentedControl from '@/components/ui/segmented-control/SegmentedControl.vue'
import { initialOf } from '@/lib/format'
import type { TeamMember } from '@/types/workspace'

const props = defineProps<{
  open: boolean
  member: TeamMember | null
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'change-role': [userId: string, role: string]
  remove: [userId: string, name: string]
}>()

const role = ref('editor')
const member = computed(() => props.member)
const dirty = computed(
  () => Boolean(member.value && role.value !== member.value.role),
)

watch(
  () => [props.open, props.member] as const,
  () => {
    const current = props.member?.role
    role.value = current === 'viewer' ? 'viewer' : 'editor'
  },
)

const save = () => {
  if (!member.value || props.busy || !dirty.value) return
  emit('change-role', member.value.userId, role.value)
}

const remove = () => {
  if (!member.value || props.busy) return
  emit('remove', member.value.userId, member.value.user.name)
}
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogContent v-if="member">
      <template #header>
        <DialogTitle>팀원 관리</DialogTitle>
        <div class="mt-4 flex items-center gap-3">
          <Avatar class="size-11 text-[15px]">
            {{ initialOf(member.user.name) }}
          </Avatar>
          <div class="min-w-0">
            <p class="truncate text-[15px] font-semibold">
              {{ member.user.name }}
            </p>
            <p class="truncate text-[13px] text-muted-foreground">
              {{ member.user.email }}
            </p>
          </div>
        </div>
      </template>
      <div class="space-y-5">
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
        <div class="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="softDestructive"
            class="h-12"
            :disabled="busy"
            @click="remove"
          >
            내보내기
          </Button>
          <Button
            type="button"
            class="h-12"
            :disabled="busy || !dirty"
            @click="save"
          >
            저장
          </Button>
        </div>
      </div>
    </DialogContent>
  </DialogRoot>
</template>
