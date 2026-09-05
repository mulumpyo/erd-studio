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

type SheetSnap = 'peek' | 'mid' | 'full'

const peekRef = ref<HTMLElement | null>(null)
const dragOffset = ref(0)
const dragging = ref(false)
const viewportH = ref(800)
const snap = ref<SheetSnap>('peek')
const MIN_PEEK = 88
const MID_MAX = 28 * 16

let pointerId = 0
let startY = 0
let startX = 0
let startOffset = 0
let tracking = false
let moved = false
let lastY = 0
let lastT = 0
let velocity = 0

const measureArea = () => {
  const host = peekRef.value?.closest(
    '[data-erd-sheet-host]',
  ) as HTMLElement | null
  viewportH.value = host?.clientHeight || window.innerHeight - 64
}

const sheetHeight = computed(() => Math.max(viewportH.value, MIN_PEEK))

const peekHeight = () =>
  Math.max(peekRef.value?.offsetHeight || 0, MIN_PEEK)

const midHeight = () => {
  const classic =
    typeof window === 'undefined'
      ? MID_MAX
      : Math.min(window.innerHeight * 0.48, MID_MAX)
  return Math.min(Math.max(classic, peekHeight()), sheetHeight.value)
}

const peekOffset = () => Math.max(0, sheetHeight.value - peekHeight())

const midOffset = () => Math.max(0, sheetHeight.value - midHeight())

const offsetFor = (next: SheetSnap) => {
  if (next === 'full') return 0
  if (next === 'mid') return midOffset()
  return peekOffset()
}

const settleSnap = (predicted: number): SheetSnap => {
  const peek = peekOffset()
  const mid = midOffset()
  const from = snap.value
  const travel = startOffset - predicted
  const flick = velocity * 180
  const intent = travel + (velocity < 0 ? Math.abs(flick) : -Math.abs(flick))

  if (Math.abs(travel) < 36 && Math.abs(velocity) < 0.45) return from

  if (from === 'peek') {
    if (intent < 36) return 'peek'
    return predicted < mid ? 'full' : 'mid'
  }
  if (from === 'mid') {
    if (intent > 48 && predicted < mid) return 'full'
    if (intent < -48) return 'peek'
    return 'mid'
  }
  if (predicted > (mid + peek) / 2) return 'peek'
  if (intent < -48 || predicted > mid / 2) return 'mid'
  return 'full'
}

const publishPeek = () => {
  const peek = props.compact ? Math.max(peekHeight(), MIN_PEEK) : 16
  document.documentElement.style.setProperty('--erd-sheet-peek', `${peek}px`)
}

const applySnap = (next: SheetSnap, notify = true) => {
  snap.value = next
  dragOffset.value = offsetFor(next)
  if (!notify) return
  const expanded = next !== 'peek'
  if (expanded !== Boolean(props.expanded)) emit('toggle')
}

const syncOffset = () => {
  if (!props.compact || dragging.value) return
  if (!props.expanded) snap.value = 'peek'
  else if (snap.value === 'peek') snap.value = 'mid'
  dragOffset.value = offsetFor(snap.value)
  publishPeek()
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
  dragOffset.value = Math.min(peekOffset(), Math.max(0, startOffset + dy))
}

const onSheetPointerUp = (event: PointerEvent) => {
  if (!tracking || event.pointerId !== pointerId) return
  tracking = false
  if (!dragging.value) return
  dragging.value = false
  applySnap(settleSnap(dragOffset.value + velocity * 180))
}

const onPeekClick = (event: MouseEvent) => {
  if (!moved) return
  event.preventDefault()
  event.stopPropagation()
}

const onHandleClick = () => {
  if (moved) return
  if (snap.value === 'peek') applySnap('mid')
  else if (snap.value === 'full') applySnap('mid')
  else applySnap('peek')
}

const onResize = () => {
  measureArea()
  syncOffset()
}

watch(
  () => [props.compact, props.expanded] as const,
  async () => {
    await nextTick()
    measureArea()
    syncOffset()
  },
  { flush: 'post' },
)

onMounted(async () => {
  await nextTick()
  measureArea()
  syncOffset()
  window.addEventListener('resize', onResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  document.documentElement.style.removeProperty('--erd-sheet-peek')
})
</script>

<template>
  <aside
    class="pointer-events-auto flex min-h-0 flex-col bg-card"
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
        :aria-expanded="snap !== 'peek'"
        :aria-label="
          snap === 'peek'
            ? '속성 패널 펼치기'
            : snap === 'full'
              ? '속성 패널 줄이기'
              : '속성 패널 접기'
        "
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
