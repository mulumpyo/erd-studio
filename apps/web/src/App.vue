<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router'
import ConfirmDialog from '@/components/ui/confirm/ConfirmDialog.vue'
import ToastHost from '@/components/ui/toast/ToastHost.vue'

const route = useRoute()
</script>

<template>
  <RouterView :key="route.path" />
  <ConfirmDialog />
  <ToastHost />
</template>
