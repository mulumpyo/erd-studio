<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
import { useVModel } from '@vueuse/core'

const props = defineProps<{
  defaultValue?: string | number
  modelValue?: string | number
  class?: HTMLAttributes['class']
  disabled?: boolean
}>()
const emits = defineEmits<{
  (e: 'update:modelValue', payload: string | number): void
}>()
const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
</script>

<template>
  <select
    v-model="modelValue"
    :disabled="disabled"
    :class="
      cn(
        'flex h-12 w-full rounded-xl border-0 bg-muted px-3 text-[15px] tracking-[-0.01em] shadow-none transition-colors focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
  >
    <slot />
  </select>
</template>
