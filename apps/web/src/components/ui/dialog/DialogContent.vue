<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
} from 'reka-ui'
import { X } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
  nested?: boolean
  alert?: boolean
}>()

const onOpenAutoFocus = (event: Event) => {
  if (props.nested && !props.alert) event.preventDefault()
}
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      :class="
        cn(
          'fixed inset-0 bg-black/30 data-[state=open]:animate-in data-[state=closed]:animate-out',
          props.nested ? 'z-[70]' : 'z-50',
        )
      "
    />
    <DialogContent
      :class="
        cn(
          'fixed left-1/2 top-1/2 flex w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden border-0 bg-card p-0 shadow-[0_16px_48px_rgb(25_31_40_/_0.16)] sm:rounded-[24px]',
          props.alert
            ? 'max-h-[min(90vh,36rem)] max-w-[360px]'
            : 'max-h-[min(90vh,46rem)] max-w-lg',
          props.nested ? 'z-[80]' : 'z-50',
          props.class,
        )
      "
      @open-auto-focus="onOpenAutoFocus"
    >
      <template v-if="alert">
        <div class="px-6 pb-6 pt-7">
          <slot />
        </div>
      </template>
      <template v-else>
        <div class="relative shrink-0 px-7 pb-5 pt-7 pr-12">
          <slot name="header" />
          <DialogClose
            class="absolute right-5 top-5 rounded-xl p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X class="size-4" />
          </DialogClose>
        </div>
        <div
          class="dialog-body min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-7 pb-7 pt-1"
        >
          <slot />
        </div>
      </template>
    </DialogContent>
  </DialogPortal>
</template>
