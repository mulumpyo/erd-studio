<script setup lang="ts">
import { ref } from 'vue'
import type { CollabUser } from '@/composables/useErdSession'
import { initialOf } from '@/lib/format'
import { safeCssColor } from '@/lib/color'

const props = defineProps<{ users: CollabUser[] }>()
const hovered = ref<string | null>(null)

const keyOf = (user: CollabUser, index: number) =>
  user.id || `guest-${user.name}-${index}`
</script>

<template>
  <div v-if="users.length" class="flex items-center pr-1">
    <div
      v-for="(user, index) in users"
      :key="keyOf(user, index)"
      class="relative"
      :style="{
        zIndex: hovered === keyOf(user, index) ? 30 : users.length - index,
        marginLeft: index ? '-8px' : '0',
      }"
      @mouseenter="hovered = keyOf(user, index)"
      @mouseleave="hovered = null"
    >
      <div
        class="flex size-8 items-center justify-center rounded-full border-2 border-white text-[12px] font-bold text-white"
        :style="{ background: safeCssColor(user.color) }"
      >
        {{ initialOf(user.name) }}
      </div>
      <div
        v-if="hovered === keyOf(user, index)"
        class="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-40 min-w-36 rounded-2xl bg-[#191f28] px-3.5 py-2.5 text-white shadow-[0_12px_32px_rgb(25_31_40_/_0.24)]"
      >
        <div class="text-[13px] font-bold tracking-[-0.02em]">
          {{ user.self ? `${user.name} (나)` : user.name }}
        </div>
        <p
          v-if="user.email"
          class="mt-0.5 text-[12px] font-medium text-white/65"
        >
          {{ user.email }}
        </p>
      </div>
    </div>
  </div>
</template>
