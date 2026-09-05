<script setup lang="ts">
import { onMounted, onUnmounted, provide, ref } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { RouterLink } from 'vue-router'
import { ChevronRight, PanelLeft } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { CLOSE_APP_NAV_KEY } from '@/components/layout/shell'
import Separator from '@/components/ui/separator/Separator.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'

defineProps<{
  kicker: string
  title: string
  kickerTo?: RouteLocationRaw
}>()

const navOpen = ref(false)
const desktopOpen = ref(true)

const closeNav = () => {
  navOpen.value = false
}

provide(CLOSE_APP_NAV_KEY, closeNav)

const toggleNav = () => {
  if (window.matchMedia('(min-width: 768px)').matches) {
    desktopOpen.value = !desktopOpen.value
    return
  }
  navOpen.value = !navOpen.value
}

const onKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closeNav()
}

onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="flex h-[calc(100dvh-var(--vv-chrome-gap))] w-full overflow-hidden bg-background">
    <button
      v-if="navOpen"
      type="button"
      class="fixed inset-0 z-40 bg-black/40 md:hidden"
      aria-label="사이드바 닫기"
      @click="closeNav"
    />
    <aside
      :class="
        cn(
          'flex h-full min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r border-border/80 bg-card px-2 pb-2',
          'fixed bottom-[var(--vv-chrome-gap)] left-0 top-0 z-50 pt-[env(safe-area-inset-top)] transition-transform duration-200',
          navOpen ? 'translate-x-0' : '-translate-x-full',
          desktopOpen
            ? 'md:relative md:z-auto md:translate-x-0 md:transition-none'
            : 'md:hidden',
        )
      "
    >
      <slot name="sidebar" />
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="flex min-h-16 shrink-0 items-center gap-2 border-b border-border/80 bg-card px-3 pt-[env(safe-area-inset-top)]"
      >
        <button
          type="button"
          class="flex size-11 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="사이드바"
          @click="toggleNav"
        >
          <PanelLeft class="size-4" />
        </button>
        <Separator orientation="vertical" class="mr-1 h-4" />
        <nav
          class="flex min-w-0 items-center gap-1 text-[13px] font-medium tracking-[-0.02em]"
          aria-label="현재 위치"
        >
          <RouterLink
            v-if="kickerTo"
            :to="kickerTo"
            class="shrink-0 text-muted-foreground transition-colors hover:text-foreground hover:underline"
          >
            {{ kicker }}
          </RouterLink>
          <span
            v-else
            class="hidden shrink-0 text-muted-foreground sm:inline"
            >{{ kicker }}</span
          >
          <ChevronRight
            :class="
              kickerTo
                ? 'size-3.5 shrink-0 text-muted-foreground'
                : 'hidden size-3.5 shrink-0 text-muted-foreground sm:block'
            "
          />
          <span class="truncate font-semibold">{{ title }}</span>
        </nav>
        <div class="ml-auto flex items-center gap-2">
          <slot name="header-actions" />
          <ThemeToggle />
        </div>
      </header>
      <div
        class="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[env(safe-area-inset-bottom)]"
      >
        <slot />
      </div>
    </div>
  </div>
</template>
