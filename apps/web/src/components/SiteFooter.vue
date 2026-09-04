<script setup lang="ts">
import { RouterLink } from 'vue-router'
import {
  CONTACT_INSTAGRAM_HANDLE,
  CONTACT_INSTAGRAM_URL,
  SITE_OPERATOR,
} from '@/lib/site'

defineProps<{ compact?: boolean }>()
</script>

<template>
  <footer
    class="border-t border-border/80 px-6 py-6 text-center text-[13px] text-muted-foreground"
  >
    <p v-if="!compact">지금은 베타예요. 문의·버그 제보는 인스타그램 DM으로 받아요.</p>
    <nav class="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      <a
        :href="CONTACT_INSTAGRAM_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="font-medium text-foreground hover:text-primary"
      >
        문의 {{ CONTACT_INSTAGRAM_HANDLE }}
      </a>
      <RouterLink class="hover:text-primary" to="/terms">이용약관</RouterLink>
      <RouterLink class="hover:text-primary" to="/privacy"
        >개인정보처리방침</RouterLink
      >
    </nav>
    <p class="mt-2">
      Copyright &copy; {{ new Date().getFullYear() }} {{ SITE_OPERATOR }}. All
      Rights Reserved.
    </p>
  </footer>
</template>
