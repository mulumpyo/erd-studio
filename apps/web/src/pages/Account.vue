<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/lib/format'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

const auth = useAuthStore()
const router = useRouter()
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)

const mismatch = computed(
  () => confirmPassword.value.length > 0 && confirmPassword.value !== newPassword.value,
)

const submit = async () => {
  error.value = ''
  if (newPassword.value !== confirmPassword.value) {
    error.value = '새 비밀번호가 일치하지 않아요'
    return
  }
  loading.value = true
  try {
    await auth.changePassword(currentPassword.value, newPassword.value)
    await router.replace('/login')
  } catch (e) {
    error.value = errorMessage(e, '비밀번호를 바꾸지 못했어요')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-full bg-background">
    <header
      class="flex h-16 items-center justify-between border-b border-border/80 bg-card px-6"
    >
      <button
        class="text-[17px] font-bold tracking-[-0.03em]"
        @click="router.push('/app')"
      >
        ERD Studio
      </button>
      <ThemeToggle />
    </header>

    <main class="mx-auto max-w-md space-y-6 p-8">
      <div>
        <p class="text-[15px] font-semibold text-primary">계정</p>
        <h1 class="mt-1 text-[28px] font-bold">비밀번호 변경</h1>
      </div>

      <!-- 프로필 카드 -->
      <div class="flex items-center gap-4 rounded-[20px] bg-card px-5 py-4">
        <div
          class="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary leading-none text-[15px] font-bold text-white"
        >
          {{ auth.user?.name?.charAt(0).toUpperCase() || '?' }}
        </div>
        <div class="min-w-0">
          <p class="truncate text-[15px] font-semibold">{{ auth.user?.name }}</p>
          <p class="truncate text-[13px] text-muted-foreground">{{ auth.user?.email }}</p>
        </div>
      </div>

      <!-- 비밀번호 변경 폼 -->
      <form class="space-y-5 rounded-[20px] bg-card p-6" @submit.prevent="submit">
        <div class="space-y-2">
          <Label>현재 비밀번호</Label>
          <Input v-model="currentPassword" type="password" required />
        </div>
        <div class="space-y-2">
          <Label>새 비밀번호</Label>
          <Input v-model="newPassword" type="password" minlength="8" required />
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
      </form>

      <Button variant="outline" class="w-full" @click="router.push('/app')">
        돌아가기
      </Button>
    </main>
  </div>
</template>
