<script setup lang="ts">
import { ChevronUp } from 'lucide-vue-next'
import SegmentedControl from '@/components/ui/segmented-control/SegmentedControl.vue'

defineProps<{
  tab: string
  tabs: Array<{ value: string; label: string; badge?: number }>
  compact?: boolean
  expanded?: boolean
}>()

const emit = defineEmits<{
  'update:tab': [value: string]
  toggle: []
}>()
</script>

<template>
  <aside
    class="flex min-h-0 flex-col bg-card"
    :class="
      compact
        ? [
            'z-20 border-t border-border/80 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_28px_rgb(25_31_40_/_0.1)]',
            expanded ? 'h-[min(52vh,32rem)]' : '',
          ]
        : ''
    "
  >
    <button
      v-if="compact"
      type="button"
      class="flex w-full flex-col items-center pt-2"
      :aria-expanded="expanded"
      :aria-label="expanded ? '속성 패널 접기' : '속성 패널 펼치기'"
      @click="emit('toggle')"
    >
      <span class="h-1 w-10 rounded-full bg-border" />
    </button>
    <div class="flex items-center gap-2 px-3" :class="compact ? 'py-2' : 'p-3'">
      <SegmentedControl
        class="min-w-0 flex-1"
        :model-value="tab"
        :options="tabs"
        @update:model-value="emit('update:tab', String($event))"
      />
      <button
        v-if="compact"
        type="button"
        class="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted"
        :aria-label="expanded ? '속성 패널 접기' : '속성 패널 펼치기'"
        @click="emit('toggle')"
      >
        <ChevronUp
          class="size-4 transition-transform"
          :class="!expanded && 'rotate-180'"
        />
      </button>
    </div>
    <div
      v-show="!compact || expanded"
      data-inspector-scroll
      class="min-h-0 flex-1 overflow-auto px-4 pb-4"
    >
      <slot />
    </div>
  </aside>
</template>
