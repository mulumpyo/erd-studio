<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue: string
  options: Array<{ value: string; label: string; badge?: number }>
  disabled?: boolean
  class?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const selectedIndex = computed(() => {
  const index = props.options.findIndex((opt) => opt.value === props.modelValue)
  return index < 0 ? 0 : index
})

const count = computed(() => Math.max(props.options.length, 1))
</script>

<template>
  <div
    :class="
      cn('relative isolate inline-flex h-11 rounded-2xl bg-muted p-1', $props.class)
    "
  >
    <div
      class="pointer-events-none absolute top-1 bottom-1 left-1 rounded-xl bg-card shadow-sm transition-transform duration-200 ease-out"
      :style="{
        width: `calc((100% - 0.5rem) / ${count})`,
        transform: `translateX(${selectedIndex * 100}%)`,
      }"
    />
    <button
      v-for="opt in options"
      :key="opt.value"
      type="button"
      :disabled="disabled"
      class="relative z-10 flex h-full min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap px-2 text-[13px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40"
      :class="
        modelValue === opt.value
          ? 'text-foreground'
          : opt.badge
            ? 'text-primary hover:text-primary'
            : 'text-muted-foreground hover:text-foreground'
      "
      :aria-label="
        opt.badge
          ? `${opt.label}, 읽지 않은 메시지 ${opt.badge}개`
          : undefined
      "
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
      <span
        v-if="opt.badge"
        class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
      >
        {{ opt.badge > 99 ? '99+' : opt.badge }}
      </span>
    </button>
  </div>
</template>
