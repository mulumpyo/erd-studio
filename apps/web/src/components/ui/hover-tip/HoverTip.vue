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
  open.value = false
}

const follow = () => {
  if (open.value) place()
}

onMounted(() => {
  host = anchor.value?.parentElement ?? null
  if (!host) return
  host.addEventListener('mouseenter', show)
  host.addEventListener('mouseleave', hide)
  host.addEventListener('focusin', show)
  host.addEventListener('focusout', hide)
  window.addEventListener('scroll', follow, true)
  window.addEventListener('resize', follow)
  window.addEventListener('wheel', follow, { capture: true, passive: true })
})

onBeforeUnmount(() => {
  window.clearTimeout(showTimer)
  host?.removeEventListener('mouseenter', show)
  host?.removeEventListener('mouseleave', hide)
  host?.removeEventListener('focusin', show)
  host?.removeEventListener('focusout', hide)
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
