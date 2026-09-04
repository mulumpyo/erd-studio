<script setup lang="ts">
import { inject, type Component } from 'vue'
import { ArrowLeft, BarChart3, Shield, Users } from 'lucide-vue-next'
import AccountMenu from '@/components/dashboard/AccountMenu.vue'
import { CLOSE_APP_NAV_KEY } from '@/components/layout/shell'
import { cn } from '@/lib/utils'

export type AdminTab = 'usage' | 'users' | 'admins'

defineProps<{
  tab: AdminTab
  name: string
  email: string
}>()

const emit = defineEmits<{
  'update:tab': [value: AdminTab]
  back: []
  'change-password': []
  logout: []
}>()

const closeNav = inject(CLOSE_APP_NAV_KEY, () => {})

const setTab = (id: AdminTab) => {
  emit('update:tab', id)
  closeNav()
}

const groups: {
  title: string
  items: { id: AdminTab; label: string; icon: Component }[]
}[] = [
  {
    title: '운영',
    items: [{ id: 'usage', label: '사용량', icon: BarChart3 }],
  },
  {
    title: '계정',
    items: [
      { id: 'users', label: '사용자 관리', icon: Users },
      { id: 'admins', label: '관리자', icon: Shield },
    ],
  },
]
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      class="-mx-2 flex h-16 shrink-0 items-center gap-3 px-4"
    >
      <div
        class="flex size-11 items-center justify-center rounded-[12px] bg-primary text-[17px] font-bold text-white"
      >
        E
      </div>
      <div class="min-w-0 leading-tight">
        <p class="truncate text-[15px] font-semibold tracking-[-0.02em]">
          ERD Studio
        </p>
        <p class="text-[12px] text-muted-foreground">관리자</p>
      </div>
    </div>

    <nav class="mt-3 flex-1 space-y-4 overflow-y-auto px-1 pb-2">
      <div v-for="group in groups" :key="group.title">
        <p class="px-2 py-1.5 text-[13px] font-semibold tracking-[-0.02em]">
          {{ group.title }}
        </p>
        <div
          class="ml-3.5 flex translate-x-px flex-col gap-0.5 border-l border-border py-0.5 pl-2.5"
        >
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            :class="
              cn(
                'flex h-8 items-center gap-2 rounded-[10px] px-2.5 text-left text-[13px] font-medium tracking-[-0.02em] transition-colors',
                tab === item.id
                  ? 'bg-muted font-semibold text-foreground'
                  : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
              )
            "
            @click="setTab(item.id)"
          >
            <component :is="item.icon" class="size-4 shrink-0" />
            {{ item.label }}
          </button>
        </div>
      </div>
    </nav>

    <div class="mt-auto space-y-1 pt-2">
      <button
        type="button"
        class="flex h-8 w-full items-center gap-2 rounded-[10px] px-2.5 text-[13px] font-medium tracking-[-0.02em] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        @click="emit('back')"
      >
        <ArrowLeft class="size-4 shrink-0" />
        워크스페이스
      </button>
      <AccountMenu
        variant="sidebar"
        :show-admin="false"
        :name="name"
        :email="email"
        @change-password="emit('change-password')"
        @logout="emit('logout')"
      />
    </div>
  </div>
</template>
