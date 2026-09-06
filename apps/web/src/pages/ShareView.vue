<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'
import { errorMessage } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import AuthShell from '@/components/auth/AuthShell.vue'
import Button from '@/components/ui/button/Button.vue'
import Spinner from '@/components/ui/spinner/Spinner.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const error = ref('')
const loading = ref(true)

const openShared = async () => {
  error.value = ''
  loading.value = true
  try {
    const project = await api<{ id: string }>(
      `/api/projects/shared/${route.params.token}`,
      {},
      auth.token,
    )
    await router.replace(`/app/${project.id}`)
  } catch (e) {
    error.value = errorMessage(e, '공개된 다이어그램이 아니에요')
    loading.value = false
  }
}

onMounted(() => {
  void openShared()
})
</script>

<template>
  <AuthShell
    title="공유된 다이어그램"
    :subtitle="error ? undefined : '다이어그램으로 들어가는 중이에요'"
  >
    <div class="space-y-5">
      <Spinner
        v-if="loading"
        class="py-6"
        label="다이어그램으로 들어가고 있어요"
      />
      <template v-else>
        <p class="text-sm text-destructive" role="alert">{{ error }}</p>
        <Button class="w-full" @click="openShared">다시 시도</Button>
        <Button
          v-if="!auth.user"
          class="w-full"
          variant="secondary"
          @click="
            router.push({
              name: 'login',
              query: { redirect: route.fullPath },
            })
          "
          >로그인</Button
        >
        <Button
          class="w-full"
          variant="ghost"
          @click="router.replace(auth.user ? '/app' : '/')"
          >홈으로</Button
        >
      </template>
    </div>
  </AuthShell>
</template>
