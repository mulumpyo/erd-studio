<script setup lang="ts">
import type { Tool } from '@/composables/erd-tools'
import {
  MousePointer2,
  Table2,
  StickyNote,
  Link2,
  Unlink,
  GitCompare,
  Share2,
  Activity,
  Undo2,
  Redo2,
  PanelLeft,
  Settings2,
} from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import ThemeToggle from '@/components/ThemeToggle.vue'
import HoverTip from '@/components/ui/hover-tip/HoverTip.vue'

defineProps<{
  current: Tool
  flowOn?: boolean
  readOnly?: boolean
  canUndo?: boolean
  canRedo?: boolean
  showEntitiesToggle?: boolean
  entitiesOpen?: boolean
}>()
const emit = defineEmits<{
  (e: 'change', tool: Tool): void
  (e: 'toggleFlow'): void
  (e: 'undo'): void
  (e: 'redo'): void
  (e: 'toggleEntities'): void
  (e: 'settings'): void
}>()

const tools: Array<{
  id: Tool
  label: string
  hint: string
  icon: typeof Table2
}> = [
  { id: 'select', label: '선택', hint: '테이블을 고르고 옮기세요', icon: MousePointer2 },
  { id: 'table', label: '테이블', hint: '빈 곳을 클릭해 추가', icon: Table2 },
  { id: 'note', label: '메모', hint: '빈 곳을 클릭해 추가', icon: StickyNote },
  {
    id: 'identifying',
    label: '식별',
    hint: '부모 테이블을 클릭한 뒤 자식 테이블을 클릭하세요',
    icon: Link2,
  },
  {
    id: 'non-identifying',
    label: '비식별',
    hint: '부모 테이블을 클릭한 뒤 자식 테이블을 클릭하세요',
    icon: Unlink,
  },
  {
    id: 'one-to-one',
    label: '1:1',
    hint: '테이블 두 개를 차례로 클릭하세요',
    icon: GitCompare,
  },
  {
    id: 'many-to-many',
    label: 'N:M',
    hint: '테이블 두 개를 차례로 클릭하세요',
    icon: Share2,
  },
]
</script>

<template>
  <aside
    class="z-20 flex h-full flex-col items-center gap-1 overflow-x-hidden overflow-y-auto overscroll-contain border-r border-border/80 bg-card py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
  >
    <button
      v-if="showEntitiesToggle"
      type="button"
      aria-label="엔티티 목록"
      :class="
        cn(
          'has-tip relative flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-2xl text-muted-foreground hover:bg-muted',
          entitiesOpen && 'bg-primary text-white hover:bg-primary',
        )
      "
      @click="emit('toggleEntities')"
    >
      <PanelLeft class="size-4" />
      <span class="text-[9px] font-semibold leading-none tracking-[-0.02em]"
        >엔티티</span
      >
      <HoverTip>엔티티 목록</HoverTip>
    </button>
    <div v-if="showEntitiesToggle" class="my-1 h-px w-6 bg-border" />
    <button
      type="button"
      aria-label="실행 취소 (Ctrl+Z)"
      :disabled="readOnly || !canUndo"
      :class="
        cn(
          'has-tip relative flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-2xl text-muted-foreground hover:bg-muted',
          (readOnly || !canUndo) && 'pointer-events-none opacity-30',
        )
      "
      @click="emit('undo')"
    >
      <Undo2 class="size-4" />
      <span class="text-[9px] font-semibold leading-none tracking-[-0.02em]"
        >취소</span
      >
      <HoverTip>실행 취소 (Ctrl+Z)</HoverTip>
    </button>
    <button
      type="button"
      aria-label="다시 실행 (Ctrl+Y)"
      :disabled="readOnly || !canRedo"
      :class="
        cn(
          'has-tip relative flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-2xl text-muted-foreground hover:bg-muted',
          (readOnly || !canRedo) && 'pointer-events-none opacity-30',
        )
      "
      @click="emit('redo')"
    >
      <Redo2 class="size-4" />
      <span class="text-[9px] font-semibold leading-none tracking-[-0.02em]"
        >재실행</span
      >
      <HoverTip>다시 실행 (Ctrl+Y)</HoverTip>
    </button>
    <div class="my-1 h-px w-6 bg-border" />
    <button
      v-for="t in tools"
      :key="t.id"
      type="button"
      :aria-label="`${t.label} — ${t.hint}`"
      :disabled="readOnly && t.id !== 'select'"
      :class="
        cn(
          'has-tip relative flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-2xl text-muted-foreground hover:bg-muted',
          current === t.id && 'bg-primary text-white hover:bg-primary',
          readOnly && t.id !== 'select' && 'pointer-events-none opacity-30',
        )
      "
      @click="emit('change', readOnly && t.id !== 'select' ? 'select' : t.id)"
    >
      <component :is="t.icon" class="size-4" />
      <span class="text-[9px] font-semibold leading-none tracking-[-0.02em]">{{
        t.label
      }}</span>
      <HoverTip>{{ t.label }} — {{ t.hint }}</HoverTip>
    </button>
    <div class="my-1 h-px w-6 bg-border" />
    <button
      type="button"
      aria-label="관계 흐름 — 부모에서 자식으로 방향이 보여요"
      :class="
        cn(
          'has-tip relative flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-2xl text-muted-foreground hover:bg-muted',
          flowOn && 'bg-primary text-white hover:bg-primary',
        )
      "
      @click="emit('toggleFlow')"
    >
      <Activity class="size-4" />
      <span class="text-[9px] font-semibold leading-none tracking-[-0.02em]"
        >흐름</span
      >
      <HoverTip>관계 흐름 — 부모에서 자식으로 방향이 보여요</HoverTip>
    </button>
    <div class="mt-auto flex flex-col items-center gap-1">
      <div class="my-1 h-px w-6 bg-border" />
      <ThemeToggle rail />
      <button
        type="button"
        aria-label="프로젝트 설정"
        class="has-tip relative flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-2xl text-muted-foreground hover:bg-muted"
        @click="emit('settings')"
      >
        <Settings2 class="size-4" />
        <span class="text-[9px] font-semibold leading-none tracking-[-0.02em]"
          >설정</span
        >
        <HoverTip>프로젝트 설정</HoverTip>
      </button>
    </div>
  </aside>
</template>
