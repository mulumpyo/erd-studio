<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { GripVertical, Plus } from 'lucide-vue-next'
import {
  COLUMN_TYPES,
  TABLE_COLORS,
  applyDomain,
  columnRank,
  defaultColumn,
  orderTableColumns,
  type ErdColumn,
  type ErdDomain,
  type ErdRelation,
  type ErdTable,
} from '@erd-studio/shared'
import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import Select from '@/components/ui/select/Select.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import DomainPanel from '@/components/editor/DomainPanel.vue'
import RelationInspector from '@/components/editor/RelationInspector.vue'
import HoverTip from '@/components/ui/hover-tip/HoverTip.vue'
import { confirm } from '@/composables/useConfirm'

const props = defineProps<{
  table: ErdTable | null
  relation?: ErdRelation | null
  tables?: ErdTable[]
  domains: ErdDomain[]
  readOnly?: boolean
  selectedColumnId?: string | null
}>()
const emit = defineEmits<{
  (e: 'update', table: ErdTable): void
  (e: 'remove'): void
  (e: 'update-relation', relation: ErdRelation): void
  (e: 'remove-relation'): void
  (e: 'add-domain', domain: ErdDomain): void
  (e: 'update-domain', domain: ErdDomain): void
  (e: 'remove-domain', id: string): void
  (e: 'select-column', id: string): void
}>()

const dragIndex = ref<number | null>(null)
const overIndex = ref<number | null>(null)
const columnListRef = ref<HTMLElement | null>(null)
const typeOptions = COLUMN_TYPES.map((type) => ({ value: type, label: type }))
const domainOptions = computed(() => [
  { value: '', label: '선택 안 함' },
  ...props.domains.map((domain) => ({ value: domain.id, label: domain.name })),
])

const revealColumn = (id: string) => {
  const root = columnListRef.value
  if (!root) return false
  const card = root.querySelector<HTMLElement>(
    `[data-column-id="${CSS.escape(id)}"]`,
  )
  if (!card) return false
  const scroller = card.closest('[data-inspector-scroll]')
  if (scroller instanceof HTMLElement) {
    const cardBox = card.getBoundingClientRect()
    const viewBox = scroller.getBoundingClientRect()
    const top =
      scroller.scrollTop +
      (cardBox.top - viewBox.top) -
      (viewBox.height - cardBox.height) / 2
    scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  } else {
    card.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  if (card.contains(document.activeElement)) return true
  const input = card.querySelector<HTMLInputElement>(
    'input:not([type=checkbox]):not([type=color])',
  )
  if (input && !input.disabled) input.focus({ preventScroll: true })
  else card.focus({ preventScroll: true })
  return true
}

watch(
  () => [props.table?.id, props.selectedColumnId] as const,
  async ([, id]) => {
    if (!id || !props.table) return
    for (const wait of [0, 16, 50, 120]) {
      if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait))
      else await nextTick()
      if (revealColumn(id)) return
    }
  },
  { immediate: true },
)

const patch = (partial: Partial<ErdTable>) => {
  if (!props.table || props.readOnly) return
  emit('update', { ...props.table, ...partial })
}

const patchColumn = (index: number, partial: Partial<ErdColumn>) => {
  if (!props.table || props.readOnly) return
  const columns = orderTableColumns(
    props.table.columns.map((c, i) =>
      i === index ? { ...c, ...partial } : c,
    ),
  )
  emit('update', { ...props.table, columns })
}

const assignDomain = (index: number, domainId: string) => {
  if (!props.table) return
  const col = props.table.columns[index]
  const domain = props.domains.find((item) => item.id === domainId)
  patchColumn(index, applyDomain(col, domain))
}

const addColumn = () => {
  if (!props.table || props.readOnly) return
  emit('update', {
    ...props.table,
    columns: [...props.table.columns, defaultColumn()],
  })
}

const removeColumn = async (index: number) => {
  if (!props.table || props.readOnly) return
  if (props.table.columns.length <= 1) return
  const col = props.table.columns[index]
  const name = col?.logicalName || col?.physicalName || '이 컬럼'
  const ok = await confirm({
    title: '컬럼을 삭제할까요?',
    description: `"${name}" 컬럼이 사라져도 Ctrl+Z로 되돌릴 수 있어요.`,
    confirmLabel: '삭제하기',
    destructive: true,
  })
  if (!ok) return
  emit('update', {
    ...props.table,
    columns: props.table.columns.filter((_, i) => i !== index),
  })
}

const moveColumn = (from: number, to: number) => {
  if (!props.table || props.readOnly || from === to) return
  const columns = [...props.table.columns]
  const fromCol = columns[from]
  const toCol = columns[to]
  if (!fromCol || !toCol) return
  if (columnRank(fromCol) !== columnRank(toCol)) return
  const [item] = columns.splice(from, 1)
  if (!item) return
  columns.splice(to, 0, item)
  emit('update', { ...props.table, columns: orderTableColumns(columns) })
}

const onDragStart = (index: number, event: DragEvent) => {
  if (props.readOnly) return
  dragIndex.value = index
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

const onDragOver = (index: number, event: DragEvent) => {
  event.preventDefault()
  const from = dragIndex.value
  const columns = props.table?.columns
  if (
    from == null ||
    !columns?.[from] ||
    !columns[index] ||
    columnRank(columns[from]) !== columnRank(columns[index])
  ) {
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'
    overIndex.value = null
    return
  }
  overIndex.value = index
}

const onDrop = (index: number, event: DragEvent) => {
  event.preventDefault()
  const from = dragIndex.value
  dragIndex.value = null
  overIndex.value = null
  if (from == null) return
  moveColumn(from, index)
}

const onDragEnd = () => {
  dragIndex.value = null
  overIndex.value = null
}

const sameColor = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

const toHexColor = (value: string) => {
  const hex = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    const [r, g, b] = hex.slice(1)
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return '#3b82f6'
}

const isPresetColor = computed(() =>
  TABLE_COLORS.some((color) => sameColor(color, props.table?.color ?? '')),
)

const onPickColor = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  if (value) patch({ color: value })
}
</script>

<template>
  <RelationInspector
    v-if="relation"
    :relation="relation"
    :tables="tables ?? []"
    :read-only="readOnly"
    @update="emit('update-relation', $event)"
    @remove="emit('remove-relation')"
  />
  <div
    v-else-if="!table"
    class="mb-4 rounded-2xl bg-muted px-4 py-8 text-center text-[14px] leading-6 text-muted-foreground"
  >
    테이블이나 관계선을 선택하면 속성을 볼 수 있어요.
  </div>
  <p v-else-if="readOnly" class="mb-3 text-[14px] text-muted-foreground">
    보기 권한이라 다이어그램을 수정할 수 없어요.
  </p>
  <fieldset v-if="table && !relation" :disabled="readOnly" class="space-y-3">
    <div class="space-y-1">
      <Label>논리 테이블명</Label>
      <Input
        :model-value="table.logicalName"
        @change="
          patch({ logicalName: ($event.target as HTMLInputElement).value })
        "
      />
    </div>
    <div class="space-y-1">
      <Label>물리 테이블명</Label>
      <Input
        :model-value="table.physicalName"
        @change="
          patch({ physicalName: ($event.target as HTMLInputElement).value })
        "
      />
    </div>
    <div class="space-y-1">
      <Label>설명</Label>
      <Textarea
        :model-value="table.comment ?? ''"
        class="min-h-16"
        @change="
          patch({ comment: ($event.target as HTMLTextAreaElement).value })
        "
      />
    </div>
    <div class="space-y-1">
      <Label>색상</Label>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="color in TABLE_COLORS"
          :key="color"
          type="button"
          class="size-7 rounded-full"
          :style="{
            background: color,
            outline: sameColor(table.color, color) ? '2px solid black' : '',
          }"
          :title="color"
          @click="patch({ color })"
        />
        <label
          class="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-full"
          :class="
            isPresetColor
              ? 'border border-dashed border-border bg-card'
              : ''
          "
          :style="
            isPresetColor
              ? undefined
              : { background: table.color, outline: '2px solid black' }
          "
          title="직접 고르기"
        >
          <Plus
            v-if="isPresetColor"
            class="pointer-events-none absolute inset-0 m-auto size-3.5 text-[#8b95a1]"
          />
          <input
            type="color"
            class="absolute inset-0 cursor-pointer opacity-0"
            :value="toHexColor(table.color)"
            :disabled="readOnly"
            aria-label="직접 고르기"
            @input="onPickColor"
          />
        </label>
      </div>
    </div>
    <h4 class="text-[15px] font-bold tracking-[-0.02em]">컬럼</h4>
    <div ref="columnListRef" class="space-y-3">
      <div
        v-for="(col, i) in table.columns"
        :key="col.id"
        :data-column-id="col.id"
        tabindex="-1"
      class="space-y-2.5 rounded-2xl bg-card p-3 ring-1 ring-border shadow-[0_2px_8px_rgb(25_31_40_/_0.04)] outline-none"
      :class="{
        'opacity-40': dragIndex === i,
        'ring-primary': overIndex === i && dragIndex !== i,
        'ring-2 ring-primary bg-accent/60 shadow-[0_0_0_3px_rgb(49_130_246_/_0.16)]':
          selectedColumnId === col.id,
      }"
      @click="emit('select-column', col.id)"
      @dragover="onDragOver(i, $event)"
      @drop="onDrop(i, $event)"
    >
      <div class="flex items-center gap-1">
        <button
          v-if="!readOnly"
          type="button"
          class="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-xl text-[#c9cdd2] hover:bg-muted hover:text-muted-foreground active:cursor-grabbing"
          draggable="true"
          aria-label="컬럼 순서 바꾸기"
          @dragstart="onDragStart(i, $event)"
          @dragend="onDragEnd"
        >
          <GripVertical class="size-4" />
        </button>
        <span class="min-w-0 flex-1 truncate text-[12px] font-semibold text-muted-foreground">
          {{ col.logicalName || col.physicalName || `컬럼 ${i + 1}` }}
        </span>
        <Button variant="ghostDestructive" size="sm" @click="removeColumn(i)">삭제</Button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label>논리명</Label>
          <Input
            :model-value="col.logicalName"
            placeholder="논리명"
            :class="
              selectedColumnId === col.id
                ? 'bg-card ring-2 ring-ring/30'
                : undefined
            "
            @change="
              patchColumn(i, {
                logicalName: ($event.target as HTMLInputElement).value,
              })
            "
          />
        </div>
        <div class="space-y-1">
          <Label>물리명</Label>
          <Input
            :model-value="col.physicalName"
            placeholder="물리명"
            @change="
              patchColumn(i, {
                physicalName: ($event.target as HTMLInputElement).value,
              })
            "
          />
        </div>
      </div>
      <div class="space-y-1">
        <Label>도메인</Label>
        <Select
          :model-value="col.domainId ?? ''"
          :options="domainOptions"
          @update:model-value="assignDomain(i, String($event))"
        />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label>타입</Label>
          <Select
            :model-value="col.type"
            :disabled="Boolean(col.domainId)"
            :options="typeOptions"
            @update:model-value="patchColumn(i, { type: String($event) })"
          />
        </div>
        <div class="space-y-1">
          <Label>길이</Label>
          <Input
            :model-value="col.length"
            placeholder="길이"
            :disabled="Boolean(col.domainId)"
            @change="
              patchColumn(i, {
                length: ($event.target as HTMLInputElement).value,
              })
            "
          />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label>기본값</Label>
          <Input
            :model-value="col.defaultValue"
            placeholder="기본값"
            @change="
              patchColumn(i, {
                defaultValue: ($event.target as HTMLInputElement).value,
              })
            "
          />
        </div>
        <div class="space-y-1">
          <Label>설명</Label>
          <Input
            :model-value="col.comment"
            placeholder="설명"
            @change="
              patchColumn(i, {
                comment: ($event.target as HTMLInputElement).value,
              })
            "
          />
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label
          class="has-tip relative flex items-center gap-1.5 text-[13px] font-semibold"
        >
          <Checkbox
            :checked="col.pk"
            :disabled="readOnly"
            @update:checked="patchColumn(i, { pk: $event })"
          />
          PK
          <HoverTip side="top">기본 키 — 행을 구분하는 값이에요</HoverTip>
        </label>
        <label
          class="has-tip relative flex items-center gap-1.5 text-[13px] font-semibold"
        >
          <Checkbox
            :checked="col.nn"
            :disabled="readOnly || Boolean(col.domainId)"
            @update:checked="patchColumn(i, { nn: $event })"
          />
          NN
          <HoverTip side="top">NULL 불가 — 비워 둘 수 없어요</HoverTip>
        </label>
        <label
          class="has-tip relative flex items-center gap-1.5 text-[13px] font-semibold"
        >
          <Checkbox
            :checked="col.unique"
            :disabled="readOnly"
            @update:checked="patchColumn(i, { unique: $event })"
          />
          UQ
          <HoverTip side="top">고유 값 — 같은 값이 두 번 들어갈 수 없어요</HoverTip>
        </label>
        <label
          class="has-tip relative flex items-center gap-1.5 text-[13px] font-semibold"
        >
          <Checkbox
            :checked="col.autoIncrement"
            :disabled="readOnly"
            @update:checked="patchColumn(i, { autoIncrement: $event })"
          />
          AI
          <HoverTip side="top">자동 증가 — 값을 자동으로 올려 줘요</HoverTip>
        </label>
      </div>
    </div>
    </div>
    <Button variant="secondary" class="w-full" @click="addColumn"
      >컬럼 추가</Button
    >
    <Button variant="destructive" class="w-full" @click="emit('remove')"
      >테이블 삭제</Button
    >
  </fieldset>
  <details class="mt-4 rounded-2xl bg-muted p-4" :open="!table">
    <summary class="cursor-pointer text-[14px] font-bold tracking-[-0.02em]">
      도메인
    </summary>
    <div class="mt-3">
      <DomainPanel
        :domains="domains"
        :read-only="readOnly"
        @add="emit('add-domain', $event)"
        @update="emit('update-domain', $event)"
        @remove="emit('remove-domain', $event)"
      />
    </div>
  </details>
</template>
