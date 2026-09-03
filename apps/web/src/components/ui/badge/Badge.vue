<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex items-center rounded-full border-0 bg-muted px-2.5 py-0.5 text-[12px] font-semibold tracking-[-0.01em] text-muted-foreground',
        props.class,
      )
    "
  >
    <slot />
  </span>
</template>
