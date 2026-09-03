<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = defineProps<{
  value: string
  editing: boolean
}>()
const emit = defineEmits<{
  commit: [value: string]
  cancel: []
}>()

const input = ref<HTMLInputElement | null>(null)
const draft = ref(props.value)

watch(
  () => props.editing,
  async (on) => {
    if (!on) return
    draft.value = props.value
    await nextTick()
    input.value?.focus()
    input.value?.select()
  },
  { immediate: true },
)

const commit = () => emit('commit', draft.value.trim() || props.value)
</script>

<template>
  <input
    v-if="editing"
    ref="input"
    v-model="draft"
    class="nodrag nopan nowheel table-inline-input"
    @blur="commit"
    @click.stop
    @mousedown.stop
    @keydown.enter.prevent="commit"
    @keydown.escape.prevent="emit('cancel')"
  />
  <slot v-else />
</template>
