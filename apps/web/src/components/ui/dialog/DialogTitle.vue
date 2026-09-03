<script setup lang="ts">
import { DialogTitle } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
</script>

<template>
  <DialogTitle
    :class="
      cn(
        'text-[22px] font-bold leading-7 tracking-[-0.04em]',
        props.class,
      )
    "
  >
    <slot />
  </DialogTitle>
</template>
