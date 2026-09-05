<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { Expand, Lock, Maximize2, Shrink, Unlock, ZoomIn, ZoomOut } from 'lucide-vue-next'
import { visibleFitPadding } from '@/composables/useCanvasInsets'

const props = defineProps<{
  readOnly?: boolean
  nodesOnly?: boolean
}>()

const locked = defineModel<boolean>('locked', { default: false })
const focus = defineModel<boolean>('focus', { default: false })

const { zoomIn, zoomOut, fitView, viewport, minZoom, maxZoom } = useVueFlow()
const atMinZoom = computed(() => viewport.value.zoom <= minZoom.value)
const atMaxZoom = computed(() => viewport.value.zoom >= maxZoom.value)

const pressed = ref<string | null>(null)
let pressTimer = 0

const flash = (id: string) => {
  pressed.value = id
  window.clearTimeout(pressTimer)
  pressTimer = window.setTimeout(() => {
    pressed.value = null
  }, 260)
}

onUnmounted(() => window.clearTimeout(pressTimer))

const onZoomIn = () => {
  if (atMaxZoom.value) return
  flash('in')
  zoomIn()
}

const onZoomOut = () => {
  if (atMinZoom.value) return
  flash('out')
  zoomOut()
}

const onFit = () => {
  flash('fit')
  fitView({ padding: visibleFitPadding(), duration: 220 })
}

const onLock = () => {
  flash('lock')
  locked.value = !locked.value
}

const onFocus = () => {
  flash('focus')
  focus.value = !focus.value
}

const lockLabel = computed(() => {
  if (props.nodesOnly) {
    return locked.value ? '고정 해제' : '테이블 고정'
  }
  return locked.value ? '잠금 해제' : '화면 잠금'
})
</script>

<template>
  <Teleport to="#erd-canvas-controls" defer>
  <div class="vue-flow__controls canvas-controls erd-canvas-controls">
    <button
      type="button"
      class="canvas-ctrl"
      :class="{ 'is-pressed': pressed === 'in' }"
      :disabled="atMaxZoom"
      aria-label="확대"
      @click="onZoomIn"
    >
      <ZoomIn />
      <span class="canvas-ctrl-tip">확대</span>
    </button>
    <button
      type="button"
      class="canvas-ctrl"
      :class="{ 'is-pressed': pressed === 'out' }"
      :disabled="atMinZoom"
      aria-label="축소"
      @click="onZoomOut"
    >
      <ZoomOut />
      <span class="canvas-ctrl-tip">축소</span>
    </button>
    <button
      type="button"
      class="canvas-ctrl"
      :class="{ 'is-pressed': pressed === 'fit' }"
      aria-label="화면에 맞추기"
      @click="onFit"
    >
      <Maximize2 />
      <span class="canvas-ctrl-tip">화면에 맞추기</span>
    </button>
    <button
      type="button"
      class="canvas-ctrl"
      :class="{
        'is-pressed': pressed === 'focus',
        'is-locked': focus,
      }"
      :aria-label="focus ? '전체 화면 끄기' : '다이어그램만 보기'"
      :aria-pressed="focus"
      @click="onFocus"
    >
      <Shrink v-if="focus" />
      <Expand v-else />
      <span class="canvas-ctrl-tip">{{
        focus ? '전체 화면 끄기' : '다이어그램만 보기'
      }}</span>
    </button>
    <button
      v-if="!readOnly"
      type="button"
      class="canvas-ctrl"
      :class="{
        'is-pressed': pressed === 'lock',
        'is-locked': locked,
      }"
      :aria-label="lockLabel"
      :aria-pressed="locked"
      @click="onLock"
    >
      <Lock v-if="locked" />
      <Unlock v-else />
      <span class="canvas-ctrl-tip">{{ lockLabel }}</span>
    </button>
  </div>
  </Teleport>
</template>
