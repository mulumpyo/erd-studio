<script setup lang="ts">
import { computed, ref } from 'vue'
import { X } from 'lucide-vue-next'
import {
  displayNames,
  type ErdTable,
  type NameMode,
} from '@erd-studio/shared'
import Input from '@/components/ui/input/Input.vue'
import SegmentedControl from '@/components/ui/segmented-control/SegmentedControl.vue'
import { safeCssColor } from '@/lib/color'

const props = defineProps<{
  tables: ErdTable[]
  selectedId?: string | null
  nameMode: NameMode
  overlay?: boolean
}>()
const emit = defineEmits<{
  select: [id: string]
  close: []
  'update:nameMode': [mode: NameMode]
}>()

const query = ref('')
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.tables
  return props.tables.filter(
    (table) =>
      table.logicalName.toLowerCase().includes(q) ||
      table.physicalName.toLowerCase().includes(q),
  )
})

const modes: Array<{ id: NameMode; label: string }> = [
  { id: 'both', label: '모두' },
  { id: 'logical', label: '논리' },
  { id: 'physical', label: '물리' },
]
</script>

<template>
  <aside class="flex h-full min-h-0 flex-col border-r border-border/80 bg-card">
    <div class="p-4">
      <div class="flex items-center justify-between gap-2">
        <div class="text-[13px] font-bold tracking-[-0.02em]">엔티티</div>
        <button
          v-if="overlay"
          type="button"
          class="flex size-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
          title="닫기"
          aria-label="엔티티 목록 닫기"
          @click="emit('close')"
        >
          <X class="size-4" />
        </button>
      </div>
      <Input v-model="query" class="mt-3 h-10" placeholder="테이블 찾기" />
      <SegmentedControl
        class="mt-3 w-full"
        :model-value="nameMode"
        :options="modes.map((item) => ({ value: item.id, label: item.label }))"
        @update:model-value="emit('update:nameMode', $event as NameMode)"
      />
    </div>
    <div class="min-h-0 flex-1 overflow-auto px-2 pb-3">
      <p
        v-if="!filtered.length"
        class="px-2 py-8 text-center text-[13px] text-muted-foreground"
      >
        {{ query ? '검색 결과가 없어요.' : '테이블이 없어요.' }}
      </p>
      <button
        v-for="table in filtered"
        :key="table.id"
        type="button"
        class="mb-1 flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left hover:bg-muted"
        :class="selectedId === table.id && 'bg-accent'"
        @click="emit('select', table.id)"
      >
        <span
          class="size-2.5 shrink-0 rounded-full"
          :style="{ background: safeCssColor(table.color) }"
        />
        <span class="min-w-0">
          <span class="block truncate text-[14px] font-semibold tracking-[-0.02em]">
            {{
              displayNames(table.logicalName, table.physicalName, nameMode)
                .primary
            }}
          </span>
          <span
            v-if="
              displayNames(table.logicalName, table.physicalName, nameMode)
                .secondary
            "
            class="block truncate font-mono text-[11px] text-muted-foreground"
          >
            {{
              displayNames(table.logicalName, table.physicalName, nameMode)
                .secondary
            }}
          </span>
        </span>
      </button>
    </div>
  </aside>
</template>
