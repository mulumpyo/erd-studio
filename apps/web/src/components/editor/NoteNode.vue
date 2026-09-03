<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import type { ErdNote } from '@erd-studio/shared'

const props = defineProps<{
  selected?: boolean
  data: {
    note: ErdNote
    readOnly?: boolean
    onPatch?: (patch: Partial<ErdNote>) => void
    onRemove?: () => void
  }
}>()

const editing = ref(false)
const draft = ref(props.data.note.text)
const input = ref<HTMLTextAreaElement | null>(null)

const start = async () => {
  if (props.data.readOnly) return
  draft.value = props.data.note.text
  editing.value = true
  await nextTick()
  input.value?.focus()
}

const commit = () => {
  if (!editing.value) return
  editing.value = false
  const text = draft.value.trim() || props.data.note.text
  if (text !== props.data.note.text) props.data.onPatch?.({ text })
}
</script>

<template>
  <div class="note-node" :class="{ selected }" @dblclick.stop="start">
    <button
      v-if="selected && !data.readOnly"
      type="button"
      class="nodrag nopan note-delete"
      title="메모 삭제"
      aria-label="메모 삭제"
      @click.stop="data.onRemove?.()"
    >
          <Trash2 />
    </button>
    <textarea
      v-if="editing"
      ref="input"
      v-model="draft"
      class="nodrag nopan nowheel note-inline"
      @blur="commit"
      @mousedown.stop
      @keydown.escape.prevent="editing = false"
    />
    <template v-else>{{ data.note.text }}</template>
  </div>
</template>
