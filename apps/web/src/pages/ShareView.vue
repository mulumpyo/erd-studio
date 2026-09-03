<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'
import { errorMessage } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import AuthShell from '@/components/auth/AuthShell.vue'
import Button from '@/components/ui/button/Button.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const error = ref('')

onMounted(async () => {
  try {
    const project = await api<{ id: string }>(
      `/api/projects/shared/${route.params.token}`,
      {},
      auth.token,
    )
    await router.replace(`/app/${project.id}`)
  } catch (e) {
    error.value = errorMessage(e, '공개된 다이어그램이 아니에요')
  }
})
</script>

<template>
  <AuthShell
    title="공유된 다이어그램"
    :subtitle="error ? undefined : '다이어그램으로 들어가는 중이에요'"
  >
    <div class="space-y-5">
      <p v-if="!error" class="text-[15px] text-muted-foreground">
        잠시만 기다려 주세요…
      </p>
      <template v-else>
        <p class="text-sm text-destructive">{{ error }}</p>
        <Button class="w-full" @click="router.replace(auth.user ? '/app' : '/')">홈으로</Button>
      </template>
    </div>
  </AuthShell>
</template>
