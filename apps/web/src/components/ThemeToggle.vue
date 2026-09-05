<script setup lang="ts">
import { computed } from 'vue'
import { Moon, Sun } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import { useTheme } from '@/composables/useTheme'

defineProps<{
  rail?: boolean
}>()

const { mode, cycle } = useTheme()

const label = computed(() =>
  mode.value === 'dark' ? '어두운 화면' : '밝은 화면',
)

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
    <Moon v-else class="size-4" />
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
    <Moon v-else aria-hidden="true" />
  </Button>
</template>
