<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <div
    :class="
      cn(
        'rounded-[20px] border-0 bg-card text-card-foreground shadow-[0_8px_24px_rgb(25_31_40_/_0.04)]',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
