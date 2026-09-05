<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/lib/format'
import { safeInternalPath } from '@/lib/urls'
import AuthShell from '@/components/auth/AuthShell.vue'
import Button from '@/components/ui/button/Button.vue'
import Spinner from '@/components/ui/spinner/Spinner.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const error = ref('')
const loading = ref(true)

onMounted(async () => {
  const token = String(route.params.token ?? '')
  if (!token) {
    error.value = '인증 링크가 올바르지 않아요'
    loading.value = false
    return
  }
  try {
    const nextPath = await auth.verifyEmail(token)
    await router.replace(safeInternalPath(nextPath) || '/app')
  } catch (e) {
    error.value = errorMessage(e, '인증하지 못했어요')
    loading.value = false
  }
})
</script>

<template>
  <AuthShell
    title="이메일 인증"
    :subtitle="error ? undefined : '인증하고 있어요'"
  >
    <div class="space-y-5">
      <Spinner
        v-if="loading"
        class="py-6"
        label="인증하고 있어요"
      />
      <template v-else>
        <p class="text-sm text-destructive">{{ error }}</p>
        <Button class="w-full" @click="router.replace('/login')">로그인으로</Button>
      </template>
    </div>
  </AuthShell>
</template>
