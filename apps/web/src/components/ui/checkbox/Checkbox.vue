<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  checked?: boolean
  disabled?: boolean
  class?: HTMLAttributes['class']
}>()
const emit = defineEmits<{
  'update:checked': [value: boolean]
}>()

const toggle = () => {
  if (props.disabled) return
  emit('update:checked', !props.checked)
}
</script>

<template>
  <button
    type="button"
    role="checkbox"
    :aria-checked="checked"
    :disabled="disabled"
    :class="
      cn(
        'relative inline-flex size-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-colors',
        'before:absolute before:-inset-3 before:block before:content-[\'\']',
        checked
          ? 'border-primary bg-primary text-white'
          : 'border-border bg-card',
        disabled && 'cursor-not-allowed opacity-40',
        props.class,
      )
    "
    @click="toggle"
  >
    <Check v-if="checked" class="size-3" :stroke-width="3" />
  </button>
</template>
