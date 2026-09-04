<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    side?: 'right' | 'top'
  }>(),
  { side: 'right' },
)

const anchor = ref<HTMLElement | null>(null)
const open = ref(false)
const top = ref(0)
const left = ref(0)
const below = ref(false)

let host: HTMLElement | null = null
let showTimer = 0
let pressTimer = 0
let hideTimer = 0
let shownByPress = false

const fineHover = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches

const place = () => {
  if (!host) return
  const box = host.getBoundingClientRect()
  if (props.side === 'top') {
    const flip = box.top < 56
    below.value = flip
    top.value = flip ? box.bottom : box.top
    left.value = box.left + box.width / 2
    return
  }
  below.value = false
  top.value = box.top + box.height / 2
  left.value = box.right
}

const show = () => {
  window.clearTimeout(showTimer)
  showTimer = window.setTimeout(() => {
    place()
    open.value = true
  }, 80)
}

const hide = () => {
  window.clearTimeout(showTimer)
  window.clearTimeout(pressTimer)
  window.clearTimeout(hideTimer)
  shownByPress = false
  open.value = false
}

const hideSoon = () => {
  window.clearTimeout(showTimer)
  window.clearTimeout(pressTimer)
  window.clearTimeout(hideTimer)
  hideTimer = window.setTimeout(() => {
    shownByPress = false
    open.value = false
  }, 1600)
}

const follow = () => {
  if (open.value) place()
}

const onPressStart = (event: PointerEvent) => {
  if (event.pointerType === 'mouse') return
  window.clearTimeout(pressTimer)
  window.clearTimeout(hideTimer)
  pressTimer = window.setTimeout(() => {
    shownByPress = true
    place()
    open.value = true
  }, 420)
}

const onPressEnd = () => {
  window.clearTimeout(pressTimer)
  if (shownByPress) {
    hideSoon()
    return
  }
  hide()
}

onMounted(() => {
  host = anchor.value?.parentElement ?? null
  if (!host) return
  if (fineHover()) {
    host.addEventListener('mouseenter', show)
    host.addEventListener('mouseleave', hide)
    host.addEventListener('focusin', show)
    host.addEventListener('focusout', hide)
  } else {
    host.addEventListener('pointerdown', onPressStart)
    host.addEventListener('pointerup', onPressEnd)
    host.addEventListener('pointercancel', hide)
    host.addEventListener('pointerleave', hide)
  }
  window.addEventListener('scroll', follow, true)
  window.addEventListener('resize', follow)
  window.addEventListener('wheel', follow, { capture: true, passive: true })
})

onBeforeUnmount(() => {
  window.clearTimeout(showTimer)
  window.clearTimeout(pressTimer)
  window.clearTimeout(hideTimer)
  host?.removeEventListener('mouseenter', show)
  host?.removeEventListener('mouseleave', hide)
  host?.removeEventListener('focusin', show)
  host?.removeEventListener('focusout', hide)
  host?.removeEventListener('pointerdown', onPressStart)
  host?.removeEventListener('pointerup', onPressEnd)
  host?.removeEventListener('pointercancel', hide)
  host?.removeEventListener('pointerleave', hide)
  window.removeEventListener('scroll', follow, true)
  window.removeEventListener('resize', follow)
  window.removeEventListener('wheel', follow, true)
})
</script>

<template>
  <span ref="anchor" class="ui-tip-anchor" aria-hidden="true" />
  <Teleport to="body">
    <span
      v-if="open"
      class="ui-tip ui-tip-portal"
      :class="
        side === 'top'
          ? below
            ? 'ui-tip-bottom'
            : 'ui-tip-top'
          : 'ui-tip-right'
      "
      :style="{ top: `${top}px`, left: `${left}px` }"
      role="tooltip"
    >
      <slot />
    </span>
  </Teleport>
</template>
