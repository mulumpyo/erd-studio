<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/lib/format'
import { safeInternalPath } from '@/lib/urls'
import AuthShell from '@/components/auth/AuthShell.vue'
import Button from '@/components/ui/button/Button.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const sending = ref(false)
const sent = ref(false)
const error = ref('')
const email = computed(() =>
  typeof route.query.email === 'string' ? route.query.email : '',
)
const localLink = computed(() => safeInternalPath(route.query.link))

const resend = async () => {
  if (!email.value) return
  sending.value = true
  error.value = ''
  try {
    await auth.resendVerification(email.value)
    sent.value = true
  } catch (e) {
    error.value = errorMessage(e, '인증 메일을 다시 보내지 못했어요')
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <AuthShell
    title="이메일을 확인해 주세요"
    :subtitle="
      email
        ? `${email}으로 인증 메일을 보냈어요`
        : '가입한 이메일에서 인증 링크를 눌러 주세요'
    "
  >
    <div class="space-y-5">
      <p class="text-[15px] leading-6 text-muted-foreground">
        메일함에서 인증 버튼을 누르면 가입이 끝나요. 스팸함도 한 번 봐 주세요.
      </p>
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      <p v-else-if="sent" class="text-[15px] text-muted-foreground">
        인증 메일을 다시 보냈어요.
      </p>
      <Button
        v-if="localLink"
        class="w-full"
        @click="router.push(localLink)"
      >
        이메일 인증하기
      </Button>
      <Button
        variant="secondary"
        class="w-full"
        :disabled="sending || !email"
        @click="resend"
      >
        {{ sending ? '보내는 중…' : '인증 메일 다시 보내기' }}
      </Button>
      <Button variant="ghost" class="w-full" @click="router.push('/login')">
        로그인으로
      </Button>
    </div>
  </AuthShell>
</template>
