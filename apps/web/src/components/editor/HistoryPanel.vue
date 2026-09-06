<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { confirm } from '@/composables/useConfirm'
import { errorMessage } from '@/lib/format'
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
const busy = ref(false)
const error = ref('')
const notice = ref('')
const loadError = ref(false)

const load = async () => {
  loadError.value = false
  try {
    versions.value = await api(
      `/api/projects/${props.projectId}/versions`,
      {},
      auth.token,
    )
  } catch {
    versions.value = []
    loadError.value = true
  }
}

const save = async () => {
  if (props.readOnly || busy.value) return
  error.value = ''
  notice.value = ''
  busy.value = true
  try {
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
    notice.value = '버전을 남겼어요.'
    await load()
  } catch (e) {
    error.value = errorMessage(e, '버전을 남기지 못했어요')
  } finally {
    busy.value = false
  }
}

const restore = async (id: string) => {
  if (props.readOnly || busy.value) return
  const ok = await confirm({
    title: '이 버전으로 되돌릴까요?',
    description: '지금 그린 내용이 이 버전으로 바뀌어요.',
    confirmLabel: '복원하기',
    destructive: true,
  })
  if (!ok) return
  error.value = ''
  notice.value = ''
  busy.value = true
  try {
    await api(
      `/api/projects/${props.projectId}/versions/${id}/restore`,
      { method: 'POST' },
      auth.token,
    )
    notice.value = '버전을 복원했어요.'
    emit('restored')
  } catch (e) {
    error.value = errorMessage(e, '버전을 복원하지 못했어요')
  } finally {
    busy.value = false
  }
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
        :disabled="busy"
      />
      <Button class="h-12 shrink-0 px-4" :disabled="busy" @click="save"
        >버전으로 남기기</Button
      >
    </div>
    <p v-if="notice" class="text-[14px] font-medium text-[var(--editor-connected-fg)]">
      {{ notice }}
    </p>
    <p v-if="error" class="text-[14px] text-destructive" role="alert">{{ error }}</p>
    <p v-if="loadError" class="text-[14px] text-destructive" role="alert">
      버전 목록을 불러오지 못했어요.
      <button type="button" class="ml-1 font-semibold underline" @click="load">
        다시 시도
      </button>
    </p>
    <p
      v-else-if="!versions.length"
      class="text-[15px] text-muted-foreground"
    >
      {{ readOnly ? '남겨 둔 버전이 없어요.' : '아직 남겨 둔 버전이 없어요.' }}
    </p>
    <div v-for="v in versions" :key="v.id" class="rounded-2xl bg-muted p-4">
      <div class="text-[15px] font-bold tracking-[-0.01em]">
        {{ v.label || '버전' }}
      </div>
      <div class="mt-1 text-[13px] text-muted-foreground">
        {{ new Date(v.createdAt).toLocaleString() }} · {{ v.createdBy?.name }}
      </div>
      <Button
        v-if="!readOnly"
        variant="secondary"
        size="sm"
        class="mt-2"
        :disabled="busy"
        @click="restore(v.id)"
        >복원</Button
      >
    </div>
  </div>
</template>
