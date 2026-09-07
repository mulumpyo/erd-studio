<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import Input from '@/components/ui/input/Input.vue'
import { cn } from '@/lib/utils'

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: '' })
const props = defineProps<{
  prefix?: string
  class?: string
}>()
const visible = ref(false)
</script>

<template>
  <div :class="cn('relative flex w-full min-w-0 items-stretch', props.class)">
    <span
      v-if="prefix"
      class="flex shrink-0 select-none items-center pl-4 font-mono text-[14px] font-medium tracking-[-0.01em] text-muted-foreground"
      aria-hidden="true"
    >{{ prefix }}</span>
    <Input
      v-model="model"
      v-bind="$attrs"
      :type="visible ? 'text' : 'password'"
      :class="
        cn(
          'min-w-0 flex-1 pr-12',
          prefix
            ? 'rounded-none bg-transparent pl-1 shadow-none focus-visible:bg-transparent focus-visible:ring-0'
            : '',
        )
      "
    />
    <button
      type="button"
      class="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground"
      :aria-label="visible ? '비밀번호 숨기기' : '비밀번호 보기'"
      :aria-pressed="visible"
      @click="visible = !visible"
    >
      <EyeOff v-if="visible" class="size-5" aria-hidden="true" />
      <Eye v-else class="size-5" aria-hidden="true" />
    </button>
  </div>
</template>
