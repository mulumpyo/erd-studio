<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { confirm } from '@/composables/useConfirm'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'

const props = defineProps<{
  projectId: string
  readOnly?: boolean
  document?: unknown
}>()
const emit = defineEmits<{ (e: 'restored'): void }>()
const auth = useAuthStore()
const versions = ref<
  Array<{
    id: string
    label: string | null
    createdAt: string
    createdBy?: { name: string } | null
  }>
>([])
const label = ref('')

const load = async () => {
  try {
    versions.value = await api(
      `/api/projects/${props.projectId}/versions`,
      {},
      auth.token,
    )
  } catch {
    versions.value = []
  }
}

const save = async () => {
  if (props.readOnly) return
  await api(
    `/api/projects/${props.projectId}/versions`,
    {
      method: 'POST',
      body: JSON.stringify({
        label: label.value || undefined,
        document: props.document,
      }),
    },
    auth.token,
  )
  label.value = ''
  await load()
}

const restore = async (id: string) => {
  if (props.readOnly) return
  const ok = await confirm({
    title: '이 버전으로 되돌릴까요?',
    description: '지금 그린 내용이 이 버전으로 바뀌어요.',
    confirmLabel: '복원하기',
    destructive: true,
  })
  if (!ok) return
  await api(
    `/api/projects/${props.projectId}/versions/${id}/restore`,
    { method: 'POST' },
    auth.token,
  )
  emit('restored')
}

onMounted(load)
</script>

<template>
  <div class="space-y-3">
    <div v-if="!readOnly" class="flex items-center gap-2">
      <Input
        v-model="label"
        class="min-w-0 flex-1"
        placeholder="메모를 남겨 주세요"
      />
      <Button class="h-12 shrink-0 px-4" @click="save">저장</Button>
    </div>
    <p v-if="!versions.length" class="text-[15px] text-muted-foreground">
      {{ readOnly ? '저장된 버전이 없어요.' : '아직 버전이 없어요.' }}
    </p>
    <div v-for="v in versions" :key="v.id" class="rounded-2xl bg-muted p-4">
      <div class="text-[15px] font-bold tracking-[-0.02em]">{{ v.label || '버전' }}</div>
      <div class="mt-1 text-[13px] text-muted-foreground">
        {{ new Date(v.createdAt).toLocaleString() }} · {{ v.createdBy?.name }}
      </div>
      <Button
        v-if="!readOnly"
        variant="secondary"
        size="sm"
        class="mt-2"
        @click="restore(v.id)"
        >복원</Button
      >
    </div>
  </div>
</template>
