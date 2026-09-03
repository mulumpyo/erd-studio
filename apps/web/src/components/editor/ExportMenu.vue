<script setup lang="ts">
import { ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import Button from '@/components/ui/button/Button.vue'

const emit = defineEmits<{
  png: []
  svg: []
  html: []
  csv: []
  xls: []
  json: []
  importJson: [file: File]
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
onClickOutside(root, () => {
  open.value = false
})

const pick = (kind: 'png' | 'svg' | 'html' | 'csv' | 'xls' | 'json') => {
  open.value = false
  if (kind === 'png') emit('png')
  else if (kind === 'svg') emit('svg')
  else if (kind === 'html') emit('html')
  else if (kind === 'csv') emit('csv')
  else if (kind === 'xls') emit('xls')
  else emit('json')
}

const pickImport = () => {
  open.value = false
  fileInput.value?.click()
}

const onFile = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('importJson', file)
}
</script>

<template>
  <div ref="root" class="relative">
    <Button variant="secondary" size="sm" @click="open = !open"
      >내보내기</Button
    >
    <input
      ref="fileInput"
      type="file"
      accept="application/json,.json,.erd.json"
      class="hidden"
      @change="onFile"
    />
    <div
      v-if="open"
      class="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-2xl bg-card py-2 text-[14px] text-card-foreground shadow-[0_12px_32px_rgb(25_31_40_/_0.12)]"
    >
      <button
        type="button"
        class="block w-full px-4 py-2.5 text-left font-medium hover:bg-muted"
        @click="pick('json')"
      >
        ERD JSON으로 저장
      </button>
      <button
        type="button"
        class="block w-full px-4 py-2.5 text-left font-medium hover:bg-muted"
        @click="pickImport"
      >
        ERD JSON 가져오기
      </button>
      <div class="my-1 h-px bg-border" />
      <button
        type="button"
        class="block w-full px-4 py-2.5 text-left font-medium hover:bg-muted"
        @click="pick('png')"
      >
        PNG로 저장
      </button>
      <button
        type="button"
        class="block w-full px-4 py-2.5 text-left font-medium hover:bg-muted"
        @click="pick('svg')"
      >
        SVG로 저장
      </button>
      <button
        type="button"
        class="block w-full px-4 py-2.5 text-left font-medium hover:bg-muted"
        @click="pick('html')"
      >
        HTML 명세서로
      </button>
      <button
        type="button"
        class="block w-full px-4 py-2.5 text-left font-medium hover:bg-muted"
        @click="pick('xls')"
      >
        Excel로 저장
      </button>
      <button
        type="button"
        class="block w-full px-4 py-2.5 text-left font-medium hover:bg-muted"
        @click="pick('csv')"
      >
        CSV로 저장
      </button>
    </div>
  </div>
</template>
