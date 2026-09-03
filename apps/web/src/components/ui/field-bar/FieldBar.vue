<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div
    :class="
      cn(
        'flex min-w-0 w-full items-center gap-2 rounded-2xl bg-card p-1.5 pl-4 ring-1 ring-border shadow-[0_2px_8px_rgb(25_31_40_/_0.06)]',
        $props.class,
      )
    "
  >
    <slot />
  </div>
</template>
