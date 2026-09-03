<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div
    :class="
      cn(
        'flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-xs font-bold tracking-[-0.02em] text-accent-foreground',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
