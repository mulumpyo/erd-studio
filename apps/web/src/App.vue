<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import ConfirmDialog from '@/components/ui/confirm/ConfirmDialog.vue'
import ToastHost from '@/components/ui/toast/ToastHost.vue'
import InviteToastHost from '@/components/dashboard/InviteToastHost.vue'
import { useViewportChrome } from '@/composables/useViewportChrome'
import { useNotifications } from '@/composables/useNotifications'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()
const { listen, stop, load } = useNotifications(() => auth.user?.id)
useViewportChrome()

const onNotifyVisibility = () => {
  if (document.hidden) {
    stop()
    return
  }
  void load(auth.token, { announce: true, lists: true })
  listen(auth.token)
}

watch(
  () => auth.token,
  (token) => {
    if (document.hidden) return
    if (token) listen(token)
    else stop()
  },
)

onMounted(() => {
  listen(auth.token)
  document.addEventListener('visibilitychange', onNotifyVisibility)
})
onUnmounted(() => {
  stop()
  document.removeEventListener('visibilitychange', onNotifyVisibility)
})
</script>

<template>
  <RouterView :key="route.path" />
  <ConfirmDialog />
  <ToastHost />
  <InviteToastHost />
</template>
