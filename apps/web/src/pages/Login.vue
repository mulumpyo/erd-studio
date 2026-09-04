<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ApiError } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/lib/format'
import { safeInternalPath } from '@/lib/urls'
import AuthShell from '@/components/auth/AuthShell.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const redirect = computed(() => safeInternalPath(route.query.redirect))
const fromShare = computed(() =>
  Boolean(
    redirect.value?.startsWith('/s/') || redirect.value?.startsWith('/app/'),
  ),
)
const registerTo = computed(() => {
  const path = redirect.value
  if (path?.startsWith('/invite/')) {
    return {
      path: '/register',
      query: { invite: path.slice('/invite/'.length) },
    }
  }
  if (path) return { path: '/register', query: { redirect: path } }
  return '/register'
})

const submit = async () => {
  error.value = ''
  loading.value = true
  try {
    await auth.login(email.value, password.value)
    router.push(redirect.value || '/app')
  } catch (e) {
    if (
      e instanceof ApiError &&
      e.status === 403 &&
      e.message.includes('이메일 인증')
    ) {
      router.replace({
        name: 'check-email',
        query: { email: email.value },
      })
      return
    }
    error.value = errorMessage(e, '로그인하지 못했어요')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell
    title="로그인"
    :subtitle="
      fromShare
        ? '이 다이어그램을 보려면 로그인해 주세요'
        : '이메일로 계속할게요'
    "
  >
    <form class="space-y-5" @submit.prevent="submit">
      <div class="space-y-2">
        <Label>이메일</Label>
        <Input v-model="email" type="email" required />
      </div>
      <div class="space-y-2">
        <Label>비밀번호</Label>
        <Input v-model="password" type="password" required />
      </div>
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      <Button class="w-full" :disabled="loading">{{
        loading ? '로그인 중…' : '로그인'
      }}</Button>
      <p class="text-[15px] text-muted-foreground">
        <RouterLink class="font-semibold text-primary" to="/forgot-password"
          >비밀번호를 잊으셨나요?</RouterLink
        >
      </p>
      <p class="text-[15px] text-muted-foreground">
        아직 계정이 없나요?
        <RouterLink class="font-semibold text-primary" :to="registerTo"
          >회원가입</RouterLink
        >
      </p>
      <Button
        type="button"
        variant="outline"
        class="w-full"
        @click="router.push('/')"
      >
        돌아가기
      </Button>
    </form>
  </AuthShell>
</template>
