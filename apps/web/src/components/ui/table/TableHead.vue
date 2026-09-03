<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <th
    :class="
      cn(
        'h-11 px-4 text-left align-middle text-[13px] font-semibold text-muted-foreground',
        props.class,
      )
    "
  >
    <slot />
  </th>
</template>
