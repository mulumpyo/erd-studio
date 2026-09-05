<script setup lang="ts">
import { ref } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'
import Input from '@/components/ui/input/Input.vue'

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: '' })
const visible = ref(false)
</script>

<template>
  <div class="relative">
    <Input
      v-model="model"
      v-bind="$attrs"
      :type="visible ? 'text' : 'password'"
      class="pr-12"
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
