<script setup lang="ts">
import { AlertCircle, Check, X } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const { items, dismiss } = useToast()
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed z-[100] flex flex-col items-center gap-2 px-4"
      :style="{
        left: 'var(--erd-inset-left, 0px)',
        right: 'var(--erd-inset-right, 0px)',
        bottom:
          'max(2rem, calc(var(--erd-inset-bottom, 0px) + 1rem + env(safe-area-inset-bottom) + var(--vv-chrome-gap)))',
      }"
    >
      <TransitionGroup name="toast">
        <div
          v-for="item in items"
          :key="item.id"
          class="pointer-events-auto flex max-w-[90vw] items-center gap-2 rounded-2xl px-4 py-3 text-[14px] font-semibold tracking-[-0.01em] shadow-[0_12px_32px_rgb(28_25_23_/_0.24)]"
          :class="
            item.kind === 'error'
              ? 'bg-[var(--editor-offline-bg)] text-[var(--editor-offline-fg)] ring-1 ring-[var(--editor-offline-dot)]/35'
              : 'bg-[#1c1917] text-white'
          "
          :role="item.kind === 'error' ? 'alert' : 'status'"
        >
          <span
            v-if="item.kind === 'success'"
            class="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#03b26c]"
            aria-hidden="true"
          >
            <Check class="size-3 text-white" :stroke-width="3" />
          </span>
          <span
            v-else
            class="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--editor-offline-dot)] text-white"
            aria-hidden="true"
          >
            <AlertCircle class="size-3.5" :stroke-width="2.5" />
          </span>
          <span class="min-w-0">{{ item.message }}</span>
          <button
            v-if="item.kind === 'error'"
            type="button"
            class="ml-1 flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-black/5"
            aria-label="알림 닫기"
            @click="dismiss(item.id)"
          >
            <X class="size-3.5" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
