<script setup lang="ts">
import ThemeToggle from '@/components/ThemeToggle.vue'

defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <div class="relative grid min-h-full place-items-center bg-background px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))] pb-[max(2.5rem,calc(2.5rem+var(--vv-chrome-gap)))]">
    <div class="absolute right-4 top-4">
      <ThemeToggle />
    </div>
    <div class="w-full max-w-[400px]">
      <div class="mb-8 flex flex-col items-center text-center">
        <div
          class="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-white"
        >
          E
        </div>
        <h1 class="text-[28px] font-bold tracking-[-0.04em]">{{ title }}</h1>
        <p
          v-if="subtitle"
          class="mt-2 text-[15px] leading-6 text-muted-foreground"
        >
          {{ subtitle }}
        </p>
      </div>
      <div class="rounded-[24px] bg-card p-6 shadow-[0_8px_24px_rgb(25_31_40_/_0.04)]">
        <slot />
      </div>
    </div>
  </div>
</template>
