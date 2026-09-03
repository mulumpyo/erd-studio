<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/api'
import { errorMessage } from '@/lib/format'
import { safeInternalPath } from '@/lib/urls'
import AuthShell from '@/components/auth/AuthShell.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)
const emailLocked = ref(false)
const inviteToken = computed(() =>
  typeof route.query.invite === 'string' ? route.query.invite : '',
)
const redirect = computed(() => safeInternalPath(route.query.redirect))
const fromShare = computed(() =>
  Boolean(
    redirect.value?.startsWith('/s/') || redirect.value?.startsWith('/app/'),
  ),
)
const nextPath = computed(
  () =>
    (inviteToken.value ? `/invite/${inviteToken.value}` : redirect.value) ||
    undefined,
)
const loginTo = computed(() => {
  if (inviteToken.value) {
    return { path: '/login', query: { redirect: `/invite/${inviteToken.value}` } }
  }
  if (redirect.value) {
    return { path: '/login', query: { redirect: redirect.value } }
  }
  return '/login'
})
const mismatch = computed(
  () => confirmPassword.value.length > 0 && confirmPassword.value !== password.value,
)

onMounted(async () => {
  if (!inviteToken.value) return
  try {
    const invite = await api<{ email: string }>(
      `/api/invites/${inviteToken.value}`,
    )
    email.value = invite.email
    emailLocked.value = true
  } catch (e) {
    error.value = errorMessage(e, '초대를 확인하지 못했어요')
  }
})

const submit = async () => {
  error.value = ''
  if (password.value !== confirmPassword.value) {
    error.value = '비밀번호가 일치하지 않아요'
    return
  }
  loading.value = true
  try {
    const result = await auth.register(
      name.value,
      email.value,
      password.value,
      nextPath.value,
    )
    const link = result.verifyUrl
      ? new URL(result.verifyUrl, window.location.origin).pathname
      : undefined
    router.replace({
      name: 'check-email',
      query: {
        email: result.email,
        ...(link ? { link } : {}),
      },
    })
  } catch (e) {
    error.value = errorMessage(e, '가입하지 못했어요')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell
    title="회원가입"
    :subtitle="
      fromShare
        ? '이 다이어그램을 보려면 가입해 주세요'
        : '이메일 인증 후 시작할 수 있어요'
    "
  >
    <form class="space-y-5" @submit.prevent="submit">
      <div class="space-y-2">
        <Label>이름</Label>
        <Input v-model="name" required />
      </div>
      <div class="space-y-2">
        <Label>이메일</Label>
        <Input
          v-model="email"
          type="email"
          required
          :disabled="emailLocked"
        />
      </div>
      <div class="space-y-2">
        <Label>비밀번호</Label>
        <Input
          v-model="password"
          type="password"
          minlength="8"
          required
          placeholder="8자 이상"
        />
      </div>
      <div class="space-y-2">
        <Label>비밀번호 확인</Label>
        <Input
          v-model="confirmPassword"
          type="password"
          minlength="8"
          required
        />
        <p v-if="mismatch" class="text-[13px] text-destructive">
          비밀번호가 일치하지 않아요
        </p>
      </div>
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      <Button class="w-full" :disabled="loading || mismatch">{{
        loading ? '가입하는 중…' : '시작하기'
      }}</Button>
      <p class="text-[15px] text-muted-foreground">
        이미 계정이 있으신가요?
        <RouterLink class="font-semibold text-primary" :to="loginTo"
          >로그인</RouterLink
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
