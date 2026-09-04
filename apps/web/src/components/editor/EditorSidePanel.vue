<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import SegmentedControl from '@/components/ui/segmented-control/SegmentedControl.vue'

const props = defineProps<{
  tab: string
  tabs: Array<{ value: string; label: string; badge?: number }>
  compact?: boolean
  expanded?: boolean
}>()

const emit = defineEmits<{
  'update:tab': [value: string]
  toggle: []
}>()

const peekRef = ref<HTMLElement | null>(null)
const dragOffset = ref(0)
const dragging = ref(false)
const viewportH = ref(800)
const MIN_PEEK = 88

let pointerId = 0
let startY = 0
let startX = 0
let startOffset = 0
let tracking = false
let moved = false
let lastY = 0
let lastT = 0
let velocity = 0

const sheetHeight = computed(() =>
  Math.min(viewportH.value * 0.48, 28 * 16),
)

const peekHeight = () =>
  Math.max(peekRef.value?.offsetHeight || 0, MIN_PEEK)

const maxOffset = () => Math.max(0, sheetHeight.value - peekHeight())

const restOffset = () => (props.expanded ? 0 : maxOffset())

const syncOffset = () => {
  if (!props.compact || dragging.value) return
  dragOffset.value = restOffset()
}

const setExpanded = (expand: boolean) => {
  dragOffset.value = expand ? 0 : maxOffset()
  if (expand !== props.expanded) emit('toggle')
}

const onTab = (value: string) => {
  emit('update:tab', value)
  if (props.compact && !props.expanded) emit('toggle')
}

const onSheetPointerDown = (event: PointerEvent) => {
  if (!props.compact) return
  if (event.pointerType === 'mouse' && event.button !== 0) return
  tracking = true
  moved = false
  dragging.value = false
  pointerId = event.pointerId
  startY = event.clientY
  startX = event.clientX
  startOffset = dragOffset.value
  lastY = event.clientY
  lastT = event.timeStamp
  velocity = 0
}

const onSheetPointerMove = (event: PointerEvent) => {
  if (!tracking || event.pointerId !== pointerId) return
  const dx = event.clientX - startX
  const dy = event.clientY - startY
  if (!dragging.value) {
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
    if (Math.abs(dx) > Math.abs(dy)) {
      tracking = false
      return
    }
    dragging.value = true
    moved = true
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }
  const now = event.timeStamp
  const dt = Math.max(now - lastT, 1)
  velocity = (event.clientY - lastY) / dt
  lastY = event.clientY
  lastT = now
  dragOffset.value = Math.min(maxOffset(), Math.max(0, startOffset + dy))
}

const onSheetPointerUp = (event: PointerEvent) => {
  if (!tracking || event.pointerId !== pointerId) return
  tracking = false
  if (!dragging.value) return
  dragging.value = false
  const mid = maxOffset() / 2
  const flick = velocity * 180
  setExpanded(dragOffset.value + flick < mid)
}

const onPeekClick = (event: MouseEvent) => {
  if (!moved) return
  event.preventDefault()
  event.stopPropagation()
}

const onHandleClick = () => {
  if (moved) return
  emit('toggle')
}

const onResize = () => {
  viewportH.value = window.innerHeight
  syncOffset()
}

watch(
  () => [props.compact, props.expanded] as const,
  async () => {
    await nextTick()
    syncOffset()
  },
  { flush: 'post' },
)

onMounted(async () => {
  viewportH.value = window.innerHeight
  await nextTick()
  syncOffset()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <aside
    class="flex min-h-0 flex-col bg-card"
    :class="
      compact
        ? 'overflow-hidden border-t border-border/80 bg-card/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-8px_28px_rgb(25_31_40_/_0.1)] backdrop-blur-md'
        : ''
    "
    :style="
      compact
        ? {
            height: `${sheetHeight}px`,
            transform: `translateY(${dragOffset}px)`,
            transition: dragging ? 'none' : 'transform 0.22s ease',
          }
        : undefined
    "
  >
    <div
      ref="peekRef"
      @pointerdown="onSheetPointerDown"
      @pointermove="onSheetPointerMove"
      @pointerup="onSheetPointerUp"
      @pointercancel="onSheetPointerUp"
      @click.capture="onPeekClick"
    >
      <button
        v-if="compact"
        type="button"
        class="flex min-h-11 w-full touch-none flex-col items-center pt-2"
        :aria-expanded="expanded"
        :aria-label="expanded ? '속성 패널 접기' : '속성 패널 펼치기'"
        @click="onHandleClick"
      >
        <span class="h-1 w-10 rounded-full bg-border" />
      </button>
      <div :class="compact ? 'px-3 pb-2' : 'p-3'">
        <SegmentedControl
          class="w-full min-w-0"
          :model-value="tab"
          :options="tabs"
          @update:model-value="onTab(String($event))"
        />
      </div>
    </div>
    <div
      data-inspector-scroll
      class="min-h-0 flex-1 overflow-auto px-4 pb-4"
    >
      <slot />
    </div>
  </aside>
</template>
