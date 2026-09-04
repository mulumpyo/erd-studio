<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogClose,
} from 'reka-ui'
import { computed, ref } from 'vue'
import { ChevronRight, KeyRound, LogOut, Shield } from 'lucide-vue-next'
import { initialOf } from '@/lib/format'
import { cn } from '@/lib/utils'

const props = defineProps<{
  name: string
  email: string
  isAdmin?: boolean
  showAdmin?: boolean
  variant?: 'header' | 'sidebar'
}>()

const emit = defineEmits<{
  'change-password': []
  admin: []
  logout: []
}>()

const initial = computed(() => initialOf(props.name) || '?')
const sidebar = computed(() => props.variant === 'sidebar')
const adminItem = computed(() => props.isAdmin && props.showAdmin !== false)

const sheetOpen = ref(false)
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger
      :class="
        cn(
          sidebar
            ? 'flex w-full items-center gap-2.5 rounded-[12px] px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
            : 'hidden sm:flex h-9 items-center gap-2 rounded-xl px-2.5 text-[15px] font-semibold tracking-[-0.02em] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        )
      "
    >
      <div
        class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary leading-none text-[11px] font-bold text-white"
      >
        {{ initial }}
      </div>
      <div v-if="sidebar" class="min-w-0 flex-1">
        <p class="truncate text-[13px] font-semibold tracking-[-0.02em]">
          {{ name }}
        </p>
        <p class="truncate text-[12px] text-muted-foreground">{{ email }}</p>
      </div>
      <span v-else>{{ name }}</span>
      <ChevronRight
        v-if="sidebar"
        class="size-4 shrink-0 text-muted-foreground"
      />
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        :align="sidebar ? 'start' : 'end'"
        :side="sidebar ? 'top' : 'bottom'"
        :side-offset="6"
        class="z-[60] min-w-[240px] overflow-hidden rounded-2xl border-0 bg-card p-1.5 shadow-[0_8px_32px_rgb(25_31_40_/_0.14)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
      >
        <div class="flex items-center gap-3 px-3 py-3">
          <div
            class="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary leading-none text-sm font-bold text-white"
          >
            {{ initial }}
          </div>
          <div class="min-w-0">
            <p class="truncate text-[15px] font-semibold">{{ name }}</p>
            <p class="truncate text-[13px] text-muted-foreground">{{ email }}</p>
          </div>
        </div>

        <DropdownMenuSeparator class="my-1 h-px bg-border" />

        <DropdownMenuItem
          v-if="adminItem"
          class="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[14px] font-medium outline-none transition-colors hover:bg-muted focus:bg-muted"
          @select="emit('admin')"
        >
          <Shield class="size-4 shrink-0 text-muted-foreground" />
          관리자
        </DropdownMenuItem>

        <DropdownMenuItem
          class="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[14px] font-medium outline-none transition-colors hover:bg-muted focus:bg-muted"
          @select="emit('change-password')"
        >
          <KeyRound class="size-4 shrink-0 text-muted-foreground" />
          계정
        </DropdownMenuItem>

        <DropdownMenuSeparator class="my-1 h-px bg-border" />

        <DropdownMenuItem
          class="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[14px] font-medium text-destructive outline-none transition-colors hover:bg-[#fff1f1] focus:bg-[#fff1f1] dark:hover:bg-[#3a1d22] dark:focus:bg-[#3a1d22]"
          @select="emit('logout')"
        >
          <LogOut class="size-4 shrink-0" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>

  <!-- 모바일: 아이콘 버튼 + 바텀시트 -->
  <button
    v-if="!sidebar"
    type="button"
    class="flex sm:hidden h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    @click="sheetOpen = true"
  >
    <div
      class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary leading-none text-[11px] font-bold text-white"
    >
      {{ initial }}
    </div>
  </button>

  <DialogRoot v-if="!sidebar" :open="sheetOpen" @update:open="sheetOpen = $event">
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <DialogContent
        class="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-0 bg-card p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_32px_rgb(25_31_40_/_0.18)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom focus:outline-none"
      >
        <!-- 드래그 핸들 -->
        <div class="flex justify-center py-1.5">
          <div class="h-1 w-10 rounded-full bg-border" />
        </div>

        <!-- 프로필 정보 -->
        <div class="flex items-center gap-3 px-3 py-3">
          <div
            class="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary leading-none text-base font-bold text-white"
          >
            {{ initial }}
          </div>
          <div class="min-w-0">
            <p class="truncate text-[15px] font-semibold">{{ name }}</p>
            <p class="truncate text-[13px] text-muted-foreground">{{ email }}</p>
          </div>
        </div>

        <div class="mx-2 h-px bg-border" />

        <DialogClose
          v-if="adminItem"
          as-child
          @click="emit('admin')"
        >
          <button
            class="flex w-full items-center gap-3 rounded-[12px] px-4 py-3.5 text-[15px] font-medium transition-colors hover:bg-muted active:bg-muted"
          >
            <Shield class="size-[18px] shrink-0 text-muted-foreground" />
            관리자
          </button>
        </DialogClose>

        <!-- 비밀번호 변경 -->
        <DialogClose
          as-child
          @click="emit('change-password')"
        >
          <button
            class="flex w-full items-center gap-3 rounded-[12px] px-4 py-3.5 text-[15px] font-medium transition-colors hover:bg-muted active:bg-muted"
          >
            <KeyRound class="size-[18px] shrink-0 text-muted-foreground" />
            계정
          </button>
        </DialogClose>

        <div class="mx-2 h-px bg-border" />

        <!-- 로그아웃 -->
        <DialogClose
          as-child
          @click="emit('logout')"
        >
          <button
            class="flex w-full items-center gap-3 rounded-[12px] px-4 py-3.5 text-[15px] font-medium text-destructive transition-colors hover:bg-[#fff1f1] active:bg-[#fff1f1] dark:hover:bg-[#3a1d22] dark:active:bg-[#3a1d22]"
          >
            <LogOut class="size-[18px] shrink-0" />
            로그아웃
          </button>
        </DialogClose>

        <div class="h-[env(safe-area-inset-bottom)]" />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
