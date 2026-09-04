<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const { message, kind, visible } = useToast()
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 bottom-[max(2rem,calc(env(safe-area-inset-bottom)+1rem))] z-[100] flex justify-center px-4"
    >
      <Transition name="toast">
        <div
          v-if="visible"
          class="pointer-events-auto flex max-w-[90vw] items-center gap-2 rounded-full bg-[#191f28] px-5 py-3 text-[14px] font-semibold tracking-[-0.02em] text-white shadow-[0_12px_32px_rgb(25_31_40_/_0.24)]"
        >
          <span
            v-if="kind === 'success'"
            class="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#03b26c]"
          >
            <Check class="size-3 text-white" :stroke-width="3" />
          </span>
          <span>{{ message }}</span>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>
