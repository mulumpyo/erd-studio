<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue: string
  options: Array<{
    value: string
    label: string
    badge?: number
    /** 라벨 옆에 붙는 작은 상태 칩이에요 (예: 준비 중) */
    tag?: string
  }>
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

/** 옵션이 2개(공개/비공개)면 넓게, 탭이 많으면 줄이고 말줄임해요. */
const roomy = computed(() => count.value <= 2)
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
      class="relative z-10 flex h-full flex-1 items-center justify-center gap-1 whitespace-nowrap text-[13px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40"
      :class="[
        roomy ? 'min-w-[4.75rem] px-2.5' : 'min-w-0 px-1.5 sm:px-2',
        modelValue === opt.value
          ? 'text-foreground'
          : opt.badge
            ? 'text-primary hover:text-primary'
            : 'text-muted-foreground hover:text-foreground',
      ]"
      :aria-label="
        opt.badge
          ? `${opt.label}, 읽지 않은 메시지 ${opt.badge}개`
          : opt.tag
            ? `${opt.label}, ${opt.tag}`
            : undefined
      "
      @click="emit('update:modelValue', opt.value)"
    >
      <span :class="roomy ? undefined : 'truncate'">{{ opt.label }}</span>
      <span
        v-if="opt.tag"
        class="inline-flex shrink-0 items-center rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-[-0.01em] text-muted-foreground"
      >
        {{ opt.tag }}
      </span>
      <span
        v-if="opt.badge"
        class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground"
      >
        {{ opt.badge > 99 ? '99+' : opt.badge }}
      </span>
    </button>
  </div>
</template>
