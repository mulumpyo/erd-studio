<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ApiError } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/lib/format'
import { safeInternalPath } from '@/lib/urls'
import AuthShell from '@/components/auth/AuthShell.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'

const auth = useAuthStore()
const email = ref('')
const error = ref('')
const sent = ref(false)
const loading = ref(false)
const resetUrl = ref('')
const resetPath = computed(() => {
  if (!resetUrl.value) return ''
  try {
    return safeInternalPath(new URL(resetUrl.value, window.location.origin).pathname) || ''
  } catch {
    return ''
  }
})

const submit = async () => {
  error.value = ''
  loading.value = true
  try {
    const result = await auth.forgotPassword(email.value)
    sent.value = true
    resetUrl.value = result.resetUrl || ''
  } catch (e) {
    if (e instanceof ApiError) error.value = e.message
    else error.value = errorMessage(e, '메일을 보내지 못했어요')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="비밀번호 찾기" subtitle="가입한 이메일로 재설정 링크를 보내드려요">
    <form v-if="!sent" class="space-y-5" @submit.prevent="submit">
      <div class="space-y-2">
        <Label>이메일</Label>
        <Input v-model="email" type="email" required />
      </div>
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      <Button class="w-full" :disabled="loading">{{
        loading ? '보내는 중…' : '재설정 메일 보내기'
      }}</Button>
      <p class="text-[15px] text-muted-foreground">
        <RouterLink class="font-semibold text-primary" to="/login">로그인</RouterLink>
      </p>
    </form>
    <div v-else class="space-y-5">
      <p class="text-[15px] text-muted-foreground">
        계정이 있다면 재설정 메일을 보냈어요.
      </p>
      <RouterLink v-if="resetPath" class="block text-center font-semibold text-primary" :to="resetPath">
        개발용 재설정 링크 열기
      </RouterLink>
      <RouterLink class="block text-center font-semibold text-primary" to="/login"
        >로그인으로</RouterLink
      >
    </div>
  </AuthShell>
</template>
