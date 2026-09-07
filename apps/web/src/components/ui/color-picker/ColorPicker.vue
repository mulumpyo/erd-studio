<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Check, Plus, X } from 'lucide-vue-next'
import { onClickOutside, onKeyStroke, useMediaQuery } from '@vueuse/core'
import { TABLE_COLORS } from '@erd-studio/shared'
import {
  hexToHsv,
  hsvToHex,
  isLightColor,
  toHex6,
} from '@/lib/color'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/button/Button.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    colors?: readonly string[]
    disabled?: boolean
  }>(),
  {
    colors: () => TABLE_COLORS,
    disabled: false,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const svRef = ref<HTMLElement | null>(null)
const hueRef = ref<HTMLElement | null>(null)
const hexDraft = ref('')
const hexFocused = ref(false)
const hue = ref(217)
const sat = ref(0.76)
const val = ref(0.96)
const isMobile = useMediaQuery('(max-width: 639px)')
const panelStyle = ref<Record<string, string>>({})

const sameColor = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

const displayHex = computed(() => toHex6(props.modelValue))
const previewHex = computed(() => hsvToHex(hue.value, sat.value, val.value))
const isPreset = computed(() =>
  props.colors.some((color) => sameColor(color, props.modelValue)),
)
const customSelected = computed(() => !isPreset.value)
const hueFill = computed(() => `hsl(${hue.value} 100% 50%)`)

const pick = (color: string) => {
  if (props.disabled) return
  emit('update:modelValue', toHex6(color))
}

const syncFromModel = (value: string) => {
  const [h, s, v] = hexToHsv(value)
  hue.value = h
  sat.value = s
  val.value = v
  hexDraft.value = toHex6(value).slice(1)
}

const commitHsv = () => {
  pick(hsvToHex(hue.value, sat.value, val.value))
}

const placeDesktopPanel = () => {
  if (isMobile.value || !trigger.value) return
  const rect = trigger.value.getBoundingClientRect()
  const width = 288
  const gap = 10
  const left = Math.min(
    Math.max(12, rect.left + rect.width / 2 - width / 2),
    window.innerWidth - width - 12,
  )
  let top = rect.bottom + gap
  const estimatedHeight = 360
  if (top + estimatedHeight > window.innerHeight - 12) {
    top = Math.max(12, rect.top - estimatedHeight - gap)
  }
  panelStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
  }
}

const openPicker = async () => {
  if (props.disabled) return
  syncFromModel(props.modelValue)
  open.value = true
  await nextTick()
  placeDesktopPanel()
  const focusable = panel.value?.querySelector<HTMLElement>(
    'button:not([disabled]), input:not([disabled])',
  )
  focusable?.focus()
}

const closePicker = () => {
  open.value = false
  nextTick(() => trigger.value?.focus())
}

const onPanelKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Tab' || !panel.value) return
  const nodes = [
    ...panel.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ]
  if (!nodes.length) return
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

const applyHexDraft = () => {
  const raw = hexDraft.value.trim().replace(/^#/, '')
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(raw)) {
    hexDraft.value = (open.value ? previewHex.value : displayHex.value).slice(1)
    return
  }
  const hex = toHex6(`#${raw}`)
  syncFromModel(hex)
  pick(hex)
}

const onInlineHexInput = (event: Event) => {
  const raw = (event.target as HTMLInputElement).value
    .replace(/[^0-9a-fA-F]/g, '')
    .slice(0, 6)
  hexDraft.value = raw
  if (!/^[0-9a-f]{6}$/i.test(raw)) return
  const hex = toHex6(`#${raw}`)
  syncFromModel(hex)
  pick(hex)
}

const onHexFocus = (event: FocusEvent) => {
  hexFocused.value = true
  const input = event.target as HTMLInputElement
  nextTick(() => input.select())
}

const onHexBlur = () => {
  hexFocused.value = false
  applyHexDraft()
}

const onHexEnter = (event: Event) => {
  ;(event.target as HTMLInputElement).blur()
}

watch(
  () => props.modelValue,
  (value) => {
    if (hexFocused.value) return
    if (open.value) return
    hexDraft.value = toHex6(value).slice(1)
  },
  { immediate: true },
)

watch(previewHex, (hex) => {
  if (!open.value || hexFocused.value) return
  hexDraft.value = hex.slice(1)
})

watch(isMobile, () => {
  if (open.value) placeDesktopPanel()
})

onClickOutside(
  panel,
  (event) => {
    if (!open.value) return
    if (trigger.value?.contains(event.target as Node)) return
    closePicker()
  },
  { ignore: [trigger] },
)

onKeyStroke('Escape', (event) => {
  if (!open.value) return
  event.preventDefault()
  closePicker()
})

const onWindowReposition = () => {
  if (open.value) placeDesktopPanel()
}

watch(open, (next) => {
  if (next) {
    window.addEventListener('resize', onWindowReposition)
    window.addEventListener('scroll', onWindowReposition, true)
  } else {
    window.removeEventListener('resize', onWindowReposition)
    window.removeEventListener('scroll', onWindowReposition, true)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowReposition)
  window.removeEventListener('scroll', onWindowReposition, true)
})

const readSv = (clientX: number, clientY: number) => {
  const el = svRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  sat.value = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  val.value = Math.min(1, Math.max(0, 1 - (clientY - rect.top) / rect.height))
  commitHsv()
}

const readHue = (clientX: number) => {
  const el = hueRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  hue.value = Math.min(359.999, Math.max(0, ((clientX - rect.left) / rect.width) * 360))
  commitHsv()
}

const bindDrag = (
  event: PointerEvent,
  move: (ev: PointerEvent) => void,
) => {
  event.preventDefault()
  const target = event.currentTarget as HTMLElement
  target.setPointerCapture(event.pointerId)
  move(event)
  const onMove = (ev: PointerEvent) => move(ev)
  const onUp = () => {
    target.releasePointerCapture(event.pointerId)
    target.removeEventListener('pointermove', onMove)
    target.removeEventListener('pointerup', onUp)
    target.removeEventListener('pointercancel', onUp)
  }
  target.addEventListener('pointermove', onMove)
  target.addEventListener('pointerup', onUp)
  target.addEventListener('pointercancel', onUp)
}
</script>

<template>
  <div
    ref="root"
    :aria-disabled="disabled || undefined"
    :class="
      cn(
        'rounded-2xl bg-card p-2.5 ring-1 ring-border shadow-[0_2px_8px_rgb(28_25_23_/_0.04)]',
        disabled && 'pointer-events-none opacity-50',
      )
    "
  >
    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="color in colors"
        :key="color"
        type="button"
        class="relative size-8 shrink-0 rounded-[10px] transition-[transform,box-shadow] duration-150 hover:scale-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-95"
        :class="
          sameColor(modelValue, color)
            ? 'shadow-[0_0_0_2px_var(--card),0_0_0_4px_var(--primary)]'
            : 'ring-1 ring-inset ring-black/8 dark:ring-white/12'
        "
        :style="{ background: color }"
        :title="color"
        :aria-label="`색상 ${color}`"
        :aria-pressed="sameColor(modelValue, color)"
        :disabled="disabled"
        @click="pick(color)"
      >
        <Check
          v-if="sameColor(modelValue, color)"
          class="absolute inset-0 m-auto size-3.5 drop-shadow-sm"
          :class="isLightColor(color) ? 'text-stone-800' : 'text-white'"
          :stroke-width="2.75"
        />
      </button>

      <button
        ref="trigger"
        type="button"
        class="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] transition-[transform,box-shadow] duration-150 hover:scale-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-95"
        :class="
          customSelected || open
            ? 'shadow-[0_0_0_2px_var(--card),0_0_0_4px_var(--primary)]'
            : 'border border-dashed border-border bg-muted/80 text-muted-foreground hover:border-muted-foreground/40 hover:bg-muted hover:text-foreground'
        "
        :style="customSelected ? { background: modelValue } : undefined"
        title="직접 고르기"
        aria-label="직접 고르기"
        :aria-expanded="open"
        :disabled="disabled"
        @click="open ? closePicker() : openPicker()"
      >
        <Plus
          v-if="!customSelected"
          class="size-3.5"
          :stroke-width="2.5"
        />
        <Check
          v-else
          class="size-3.5 drop-shadow-sm"
          :class="isLightColor(modelValue) ? 'text-stone-800' : 'text-white'"
          :stroke-width="2.75"
        />
      </button>

      <label
        class="ml-0.5 inline-flex h-8 min-w-[5.25rem] items-center gap-0.5 rounded-[10px] bg-muted px-2.5 font-mono text-[12px] font-medium tracking-[-0.02em] text-muted-foreground tabular-nums focus-within:bg-card focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring/30"
        title="색상 코드"
      >
        <span class="select-none">#</span>
        <input
          :value="hexDraft"
          class="w-[4.2rem] bg-transparent uppercase outline-none tabular-nums text-foreground"
          maxlength="6"
          spellcheck="false"
          :disabled="disabled"
          aria-label="HEX 색상 코드"
          @focus="onHexFocus"
          @input="onInlineHexInput"
          @blur="onHexBlur"
          @keydown.enter.prevent="onHexEnter"
        />
      </label>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[90]"
      :class="isMobile ? 'flex items-center justify-center p-4' : 'pointer-events-none'"
    >
      <button
        v-if="isMobile"
        type="button"
        class="absolute inset-0 bg-black/30"
        aria-label="닫기"
        @click="closePicker"
      />
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        aria-label="색상 선택"
        class="pointer-events-auto relative w-full max-w-[20rem] overflow-hidden rounded-[24px] bg-card shadow-[0_16px_48px_rgb(28_25_23_/_0.18)] ring-1 ring-border"
        :style="isMobile ? undefined : panelStyle"
        @keydown="onPanelKeydown"
      >
        <div class="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
          <p class="text-[15px] font-bold tracking-[-0.01em]">색상 고르기</p>
          <button
            type="button"
            class="flex size-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="닫기"
            @click="closePicker"
          >
            <X class="size-4" />
          </button>
        </div>

        <div class="space-y-4 px-4 pb-4">
          <div
            ref="svRef"
            class="relative h-44 w-full touch-none overflow-hidden rounded-2xl"
            :style="{
              background: `
                linear-gradient(to top, #000, transparent),
                linear-gradient(to right, #fff, ${hueFill})
              `,
            }"
            @pointerdown="bindDrag($event, (ev) => readSv(ev.clientX, ev.clientY))"
          >
            <span
              class="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgb(0_0_0_/_0.35)]"
              :style="{
                left: `${sat * 100}%`,
                top: `${(1 - val) * 100}%`,
                background: previewHex,
              }"
            />
          </div>

          <div
            ref="hueRef"
            class="relative h-3.5 w-full touch-none rounded-full"
            style="
              background: linear-gradient(
                to right,
                #f00,
                #ff0,
                #0f0,
                #0ff,
                #00f,
                #f0f,
                #f00
              );
            "
            @pointerdown="bindDrag($event, (ev) => readHue(ev.clientX))"
          >
            <span
              class="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgb(0_0_0_/_0.35)]"
              :style="{
                left: `${(hue / 360) * 100}%`,
                background: hueFill,
              }"
            />
          </div>

          <div class="flex items-center gap-2">
            <span
              class="size-10 shrink-0 rounded-[12px] ring-1 ring-inset ring-black/8 dark:ring-white/12"
              :style="{ background: previewHex }"
            />
            <div
              class="flex h-10 min-w-0 flex-1 items-center gap-1 rounded-xl bg-muted px-3 font-mono text-[13px] tracking-[-0.02em]"
            >
              <span class="text-muted-foreground">#</span>
              <input
                :value="hexDraft"
                class="min-w-0 flex-1 bg-transparent uppercase outline-none tabular-nums"
                maxlength="6"
                spellcheck="false"
                aria-label="HEX 색상"
                @focus="onHexFocus"
                @input="onInlineHexInput"
                @blur="onHexBlur"
                @keydown.enter.prevent="onHexEnter"
              />
            </div>
          </div>

          <Button
            v-if="isMobile"
            class="w-full"
            type="button"
            @click="closePicker"
          >
            완료
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
