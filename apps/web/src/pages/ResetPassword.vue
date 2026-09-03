<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/lib/format'
import AuthShell from '@/components/auth/AuthShell.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

const mismatch = computed(
  () => confirmPassword.value.length > 0 && confirmPassword.value !== password.value,
)

const submit = async () => {
  error.value = ''
  if (password.value !== confirmPassword.value) {
    error.value = '새 비밀번호가 일치하지 않아요'
    return
  }
  loading.value = true
  try {
    await auth.resetPassword(String(route.params.token ?? ''), password.value)
    await router.replace('/login')
  } catch (e) {
    error.value = errorMessage(e, '비밀번호를 바꾸지 못했어요')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell title="새 비밀번호" subtitle="재설정 링크가 맞다면 바로 바꿀 수 있어요">
    <form class="space-y-5" @submit.prevent="submit">
      <div class="space-y-2">
        <Label>새 비밀번호</Label>
        <Input v-model="password" type="password" minlength="8" required />
      </div>
      <div class="space-y-2">
        <Label>새 비밀번호 확인</Label>
        <Input v-model="confirmPassword" type="password" minlength="8" required />
        <p v-if="mismatch" class="text-[13px] text-destructive">
          비밀번호가 일치하지 않아요
        </p>
      </div>
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      <Button class="w-full" :disabled="loading || mismatch">
        {{ loading ? '바꾸는 중…' : '비밀번호 바꾸기' }}
      </Button>
      <p class="text-[15px] text-muted-foreground">
        <RouterLink class="font-semibold text-primary" to="/login">로그인</RouterLink>
      </p>
    </form>
  </AuthShell>
</template>
