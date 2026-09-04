<script setup lang="ts">
import { computed } from 'vue'
import { Moon, Sun, Monitor } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import { useTheme } from '@/composables/useTheme'

defineProps<{
  rail?: boolean
}>()

const { mode, cycle } = useTheme()

const label = computed(() => {
  if (mode.value === 'dark') return '어두운 화면'
  if (mode.value === 'system') return '시스템 설정'
  return '밝은 화면'
})

const hint = computed(() => `${label.value} — 눌러서 바꾸기`)
</script>

<template>
  <button
    v-if="rail"
    type="button"
    data-theme-toggle
    :title="hint"
    :aria-label="hint"
    class="flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-2xl text-muted-foreground hover:bg-muted"
    @click="cycle"
  >
    <Sun v-if="mode === 'light'" class="size-4" />
    <Moon v-else-if="mode === 'dark'" class="size-4" />
    <Monitor v-else class="size-4" />
    <span class="text-[9px] font-semibold leading-none tracking-[-0.02em]"
      >화면</span
    >
  </button>
  <Button
    v-else
    type="button"
    variant="ghost"
    size="icon"
    class="size-12"
    data-theme-toggle
    :title="hint"
    :aria-label="hint"
    @click="cycle"
  >
    <Sun v-if="mode === 'light'" aria-hidden="true" />
    <Moon v-else-if="mode === 'dark'" aria-hidden="true" />
    <Monitor v-else aria-hidden="true" />
  </Button>
</template>
