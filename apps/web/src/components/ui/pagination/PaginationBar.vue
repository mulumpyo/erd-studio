<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

defineProps<{
  page: number
  pages: number
  total?: number
  noun?: string
}>()

const emit = defineEmits<{
  'update:page': [value: number]
}>()
</script>

<template>
  <div
    v-if="pages > 1 || (total != null && total > 0)"
    class="flex h-9 items-center justify-between gap-2"
  >
    <p class="min-w-0 truncate text-[13px] text-muted-foreground">
      <template v-if="total != null">{{ total }}{{ noun || '개' }}</template>
    </p>
    <div v-if="pages > 1" class="flex shrink-0 items-center gap-1.5">
      <Button
        variant="secondary"
        size="sm"
        :disabled="page <= 1"
        @click="emit('update:page', page - 1)"
      >
        이전
      </Button>
      <span class="min-w-12 text-center text-[13px] font-semibold tabular-nums">
        {{ page }} / {{ pages }}
      </span>
      <Button
        variant="secondary"
        size="sm"
        :disabled="page >= pages"
        @click="emit('update:page', page + 1)"
      >
        다음
      </Button>
    </div>
  </div>
</template>
