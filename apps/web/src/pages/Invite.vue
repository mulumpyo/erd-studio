<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'
import { errorMessage, roleLabel } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import AuthShell from '@/components/auth/AuthShell.vue'
import Button from '@/components/ui/button/Button.vue'
import Spinner from '@/components/ui/spinner/Spinner.vue'

type InvitePreview = {
  email: string
  role: string
  kind: 'team' | 'project'
  workspaceName: string
  inviterName: string
  expiresAt: string
  status: 'pending' | 'accepted' | 'expired'
  teamId?: string | null
  projectId?: string | null
}

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const token = computed(() => String(route.params.token ?? ''))
const preview = ref<InvitePreview | null>(null)
const error = ref('')
const loading = ref(true)
const accepting = ref(false)
const mismatch = ref(false)

const loginTo = computed(() => ({
  path: '/login',
  query: { redirect: `/invite/${token.value}` },
}))
const registerTo = computed(() => ({
  path: '/register',
  query: { invite: token.value },
}))

const goLogin = async () => {
  await auth.logout()
  router.push(loginTo.value)
}

const goWorkspace = async (data?: {
  kind?: string
  projectId?: string | null
}) => {
  const projectId = data?.projectId ?? preview.value?.projectId
  const kind = data?.kind ?? preview.value?.kind
  if (kind === 'project' && projectId) {
    await router.replace(`/app/${projectId}`)
    return
  }
  await router.replace('/app')
}

const accept = async () => {
  accepting.value = true
  error.value = ''
  try {
    const result = await api<{
      kind: 'team' | 'project'
      projectId?: string | null
    }>(`/api/invites/${token.value}/accept`, { method: 'POST' }, auth.token)
    await goWorkspace(result)
  } catch (e) {
    error.value = errorMessage(e, '초대를 수락하지 못했어요')
  } finally {
    accepting.value = false
  }
}

onMounted(async () => {
  try {
    preview.value = await api<InvitePreview>(`/api/invites/${token.value}`)
    loading.value = false
    if (preview.value.status === 'accepted' && auth.user) {
      await goWorkspace()
      return
    }
    if (preview.value.status !== 'pending') return
    if (!auth.user) return
    if (auth.user.email.toLowerCase() !== preview.value.email) {
      mismatch.value = true
      return
    }
    await accept()
  } catch (e) {
    error.value = errorMessage(e, '초대를 찾을 수 없어요')
    loading.value = false
  }
})
</script>

<template>
  <AuthShell
    title="초대"
    :subtitle="
      preview
        ? `${preview.inviterName}님이 ${preview.workspaceName}에 초대했어요`
        : '초대를 확인하고 있어요'
    "
  >
    <div class="space-y-5">
      <Spinner
        v-if="loading"
        class="py-6"
        label="초대를 확인하고 있어요"
      />
      <p v-else-if="error" class="text-sm text-destructive">{{ error }}</p>
      <template v-else-if="preview">
        <div class="space-y-1 text-[15px] text-muted-foreground">
          <p>{{ preview.email }} · {{ roleLabel(preview.role) }}</p>
          <p v-if="preview.status === 'expired'">이 초대는 만료됐어요.</p>
          <p v-else-if="preview.status === 'accepted'">이미 참여한 초대예요.</p>
          <p v-else-if="mismatch">
            지금 로그인한 계정이 초대받은 이메일과 달라요.
            {{ preview.email }}로 다시 로그인해 주세요.
          </p>
          <p v-else-if="accepting">참여하고 있어요…</p>
        </div>
        <div v-if="preview.status === 'pending' && !accepting" class="space-y-2">
          <Button
            v-if="auth.user && !mismatch"
            class="w-full"
            @click="accept"
          >
            수락하고 시작하기
          </Button>
          <template v-else-if="!auth.user">
            <Button class="w-full" @click="router.push(registerTo)">
              가입하고 참여하기
            </Button>
            <Button
              variant="secondary"
              class="w-full"
              @click="router.push(loginTo)"
            >
              로그인하고 참여하기
            </Button>
          </template>
          <Button v-else variant="secondary" class="w-full" @click="goLogin">
            다른 계정으로 로그인
          </Button>
        </div>
        <Button
          v-else-if="preview.status !== 'pending'"
          class="w-full"
          @click="goWorkspace()"
        >
          대시보드로
        </Button>
      </template>
    </div>
  </AuthShell>
</template>
