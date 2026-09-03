<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
import { useVModel } from '@vueuse/core'

const props = defineProps<{
  defaultValue?: string
  modelValue?: string
  disabled?: boolean
  class?: HTMLAttributes['class']
}>()
const emits = defineEmits<{ (e: 'update:modelValue', payload: string): void }>()
const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
})
</script>

<template>
  <textarea
    v-model="modelValue"
    :disabled="disabled"
    :class="
      cn(
        'flex min-h-24 w-full rounded-xl border-0 bg-muted px-4 py-3 text-[15px] tracking-[-0.01em] shadow-none placeholder:text-muted-foreground focus-visible:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
  />
</template>
