<script setup lang="ts">
import { computed, ref } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { GripVertical, Trash2 } from 'lucide-vue-next'
import {
  columnDomainLabel,
  columnRank,
  columnTypeParts,
  defaultColumn,
  displayNames,
  defaultShowFlags,
  orderTableColumns,
  viewHasExtraColumns,
  type ErdColumn,
  type ErdDomain,
  type ErdShowFlags,
  type ErdTable,
  type NameMode,
} from '@erd-studio/shared'
import InlineField from '@/components/editor/InlineField.vue'
import HoverTip from '@/components/ui/hover-tip/HoverTip.vue'
import { isLightColor, safeCssColor } from '@/lib/color'

type EditTarget =
  | { kind: 'table'; field: 'logicalName' | 'physicalName' }
  | { kind: 'col'; id: string; field: 'logicalName' | 'physicalName' }

const props = defineProps<{
  selected?: boolean
  data: {
    table: ErdTable
    readOnly?: boolean
    nameMode?: NameMode
    show?: ErdShowFlags
    domains?: ErdDomain[]
    onPatch?: (patch: Partial<ErdTable>) => void
    onAddColumn?: () => void
    onRemove?: () => void
    selectedColumnId?: string | null
    onSelectColumn?: (id: string | null) => void
    onRemoveColumn?: (id: string) => void
    linking?: boolean
    linkSource?: boolean
  }
}>()

const editing = ref<EditTarget | null>(null)

const mode = computed(() => props.data.nameMode ?? 'both')
const show = computed(() => ({ ...defaultShowFlags(), ...props.data.show }))
const wide = computed(() => viewHasExtraColumns(show.value))
const lightHead = computed(() => isLightColor(props.data.table.color))
const header = computed(() =>
  displayNames(
    props.data.table.logicalName,
    props.data.table.physicalName,
    mode.value,
  ),
)

const colNames = (col: ErdColumn) =>
  displayNames(col.logicalName, col.physicalName, mode.value)

const typeParts = (col: ErdColumn) =>
  columnTypeParts(col, props.data.domains ?? [])

const typeTitle = (col: ErdColumn) => {
  const { name, length } = typeParts(col)
  if (!name) return ''
  return length ? `${name} | ${length}` : name
}

const domainLabel = (col: ErdColumn) =>
  columnDomainLabel(col, props.data.domains ?? [])

const nullLabel = (col: ErdColumn) => (col.nn ? 'NN' : 'N')
const nullTitle = (col: ErdColumn) =>
  col.nn ? 'NULL 불가 — 비워 둘 수 없어요' : 'NULL 허용 — 비워 둘 수 있어요'

const showFlags = computed(
  () => show.value.columnUnique || show.value.columnAutoIncrement,
)

const editable = computed(() => !props.data.readOnly)

const gridTemplate = computed(() => {
  const cols = ['18px', '42px', 'minmax(8.25rem, 1.4fr)']
  if (show.value.columnDomain) cols.push('minmax(5.25rem, 0.85fr)')
  if (show.value.columnType) cols.push('minmax(8.25rem, 1fr)')
  if (show.value.columnNotNull) cols.push('2.5rem')
  if (show.value.columnDefault) cols.push('minmax(4.75rem, 0.7fr)')
  if (show.value.columnComment) cols.push('minmax(6rem, 0.9fr)')
  if (showFlags.value) cols.push('2.75rem')
  if (editable.value) cols.push('28px')
  return cols.join(' ')
})

const canEdit = () => editable.value

const startTable = (field: 'logicalName' | 'physicalName') => {
  if (!canEdit()) return
  editing.value = { kind: 'table', field }
}

const startCol = (id: string, field: 'logicalName' | 'physicalName') => {
  if (!canEdit()) return
  editing.value = { kind: 'col', id, field }
}

const isTableEdit = (field: 'logicalName' | 'physicalName') =>
  editing.value?.kind === 'table' && editing.value.field === field

const isColEdit = (id: string, field: 'logicalName' | 'physicalName') =>
  editing.value?.kind === 'col' &&
  editing.value.id === id &&
  editing.value.field === field

const patchTable = (patch: Partial<ErdTable>) => {
  props.data.onPatch?.(patch)
  editing.value = null
}

const patchColumn = (id: string, patch: Partial<ErdColumn>) => {
  props.data.onPatch?.({
    columns: orderTableColumns(
      props.data.table.columns.map((col) =>
        col.id === id ? { ...col, ...patch } : col,
      ),
    ),
  })
  editing.value = null
}

const removeColumn = (id: string) => {
  if (!canEdit()) return
  props.data.onRemoveColumn?.(id)
}

const selectColumn = (id: string) => {
  props.data.onSelectColumn?.(id)
}

const addColumn = () => {
  if (!canEdit()) return
  if (props.data.onAddColumn) props.data.onAddColumn()
  else {
    props.data.onPatch?.({
      columns: [...props.data.table.columns, defaultColumn()],
    })
  }
}

const dragId = ref<string | null>(null)
const overId = ref<string | null>(null)

const reorderColumns = (fromId: string, toId: string) => {
  if (fromId === toId) return
  const columns = [...props.data.table.columns]
  const from = columns.findIndex((col) => col.id === fromId)
  const to = columns.findIndex((col) => col.id === toId)
  if (from < 0 || to < 0) return
  const fromCol = columns[from]
  const toCol = columns[to]
  if (!fromCol || !toCol || columnRank(fromCol) !== columnRank(toCol)) return
  const [item] = columns.splice(from, 1)
  if (!item) return
  columns.splice(to, 0, item)
  props.data.onPatch?.({ columns: orderTableColumns(columns) })
}

const onDragStart = (id: string, event: DragEvent) => {
  if (!canEdit()) return
  dragId.value = id
  event.dataTransfer?.setData('text/plain', id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

const onDragOver = (id: string, event: DragEvent) => {
  event.preventDefault()
  const from = props.data.table.columns.find((col) => col.id === dragId.value)
  const to = props.data.table.columns.find((col) => col.id === id)
  if (!from || !to || columnRank(from) !== columnRank(to)) {
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'
    overId.value = null
    return
  }
  overId.value = id
}

const onDrop = (id: string, event: DragEvent) => {
  event.preventDefault()
  const fromId = dragId.value
  dragId.value = null
  overId.value = null
  if (fromId) reorderColumns(fromId, id)
}

const onDragEnd = () => {
  dragId.value = null
  overId.value = null
}
</script>

<template>
  <div
    class="table-node"
    :class="{
      selected,
      linking: data.linking,
      'link-source': data.linkSource,
      'table-wide': wide,
    }"
  >
    <div
      class="table-head"
      :class="{ 'table-head-light': lightHead }"
      :style="{ background: safeCssColor(data.table.color) }"
      @click="data.onSelectColumn?.(null)"
    >
      <div class="table-head-main">
      <InlineField
        :value="
          mode === 'physical'
            ? data.table.physicalName
            : data.table.logicalName
        "
        :editing="
          isTableEdit(mode === 'physical' ? 'physicalName' : 'logicalName')
        "
        @commit="
          patchTable(
            mode === 'physical'
              ? { physicalName: $event }
              : { logicalName: $event },
          )
        "
        @cancel="editing = null"
      >
        <div
          class="table-head-logical"
          title="더블클릭해서 이름을 바꿔 보세요"
          @dblclick.stop="
            startTable(mode === 'physical' ? 'physicalName' : 'logicalName')
          "
        >
          {{ header.primary }}
        </div>
      </InlineField>
      <InlineField
        v-if="mode === 'both'"
        :value="data.table.physicalName"
        :editing="isTableEdit('physicalName')"
        @commit="patchTable({ physicalName: $event })"
        @cancel="editing = null"
      >
        <div
          v-if="header.secondary"
          class="table-head-physical"
          @dblclick.stop="startTable('physicalName')"
        >
          {{ header.secondary }}
        </div>
      </InlineField>
      <div v-if="show.tableComment && data.table.comment" class="table-comment">
        {{ data.table.comment }}
      </div>
      </div>
      <button
        v-if="selected && canEdit()"
        type="button"
        class="nodrag nopan table-head-delete"
        title="테이블 삭제"
        aria-label="테이블 삭제"
        @click.stop="data.onRemove?.()"
      >
        <Trash2 />
      </button>
    </div>
    <div
      class="table-grid"
      :style="{ gridTemplateColumns: gridTemplate, '--erd-cols': gridTemplate }"
    >
      <div class="col-head-row">
        <div class="col-drag-spacer" />
        <div class="col-head-label">키</div>
        <div class="col-head-label">컬럼</div>
        <div v-if="show.columnDomain" class="col-head-label col-attr">도메인</div>
        <div v-if="show.columnType" class="col-head-label col-attr">타입</div>
        <div v-if="show.columnNotNull" class="col-head-label col-attr">Null</div>
        <div v-if="show.columnDefault" class="col-head-label col-attr">기본값</div>
        <div v-if="show.columnComment" class="col-head-label col-attr">설명</div>
        <div v-if="showFlags" class="col-head-label col-attr" />
        <div v-if="editable" class="col-head-label col-delete-slot" />
      </div>
    <div
      v-for="col in data.table.columns"
      :key="col.id"
      class="col-row nodrag nopan"
      :class="{
        pk: col.pk,
        fk: col.fk && !col.pk,
        dragging: dragId === col.id,
        'drag-over': overId === col.id && dragId !== col.id,
        'col-selected': data.selectedColumnId === col.id,
      }"
      @click.stop="selectColumn(col.id)"
      @dragover="onDragOver(col.id, $event)"
      @drop="onDrop(col.id, $event)"
    >
      <Handle
        :id="`${col.id}-left`"
        type="target"
        :position="Position.Left"
      />
        <button
          v-if="editable"
          type="button"
          class="nodrag nopan col-drag"
        draggable="true"
        aria-label="컬럼 순서 바꾸기"
        @dragstart.stop="onDragStart(col.id, $event)"
        @dragend="onDragEnd"
      >
        <GripVertical class="size-3.5" />
      </button>
      <div v-else class="col-drag-spacer" />
      <div class="col-keys">
        <span
          v-if="col.pk"
          class="has-tip relative key-badge key-pk"
          aria-label="기본 키 — 행을 구분하는 값이에요"
        >
          PK
          <HoverTip side="top">기본 키 — 행을 구분하는 값이에요</HoverTip>
        </span>
        <span
          v-if="col.fk"
          class="has-tip relative key-badge key-fk"
          aria-label="외래 키 — 다른 테이블과 연결돼요"
        >
          FK
          <HoverTip side="top">외래 키 — 다른 테이블과 연결돼요</HoverTip>
        </span>
      </div>
      <div class="col-names">
        <InlineField
          :value="
            mode === 'physical' ? col.physicalName : col.logicalName
          "
          :editing="
            isColEdit(
              col.id,
              mode === 'physical' ? 'physicalName' : 'logicalName',
            )
          "
          @commit="
            patchColumn(
              col.id,
              mode === 'physical'
                ? { physicalName: $event }
                : { logicalName: $event },
            )
          "
          @cancel="editing = null"
        >
          <span
            class="col-logical"
            @dblclick.stop="
              startCol(
                col.id,
                mode === 'physical' ? 'physicalName' : 'logicalName',
              )
            "
          >
            {{ colNames(col).primary }}
          </span>
        </InlineField>
        <InlineField
          v-if="mode === 'both'"
          :value="col.physicalName"
          :editing="isColEdit(col.id, 'physicalName')"
          @commit="patchColumn(col.id, { physicalName: $event })"
          @cancel="editing = null"
        >
          <span
            v-if="colNames(col).secondary"
            class="col-physical"
            @dblclick.stop="startCol(col.id, 'physicalName')"
          >
            {{ colNames(col).secondary }}
          </span>
        </InlineField>
      </div>
        <span
          v-if="show.columnDomain"
          class="col-attr col-domain"
          :class="{ 'is-empty': !domainLabel(col) }"
          :title="domainLabel(col)"
          >{{ domainLabel(col) }}</span
        >
        <span
          v-if="show.columnType"
          class="col-attr col-type"
          :class="{ 'is-empty': !typeParts(col).name }"
          :title="typeTitle(col)"
        >
          <span
            v-if="typeParts(col).name"
            class="type-badge"
            :class="`type-badge-${typeParts(col).tone}`"
          >
            <span class="type-badge-name">{{ typeParts(col).name }}</span>
            <template v-if="typeParts(col).length">
              <span class="type-badge-sep" aria-hidden="true">|</span>
              <span class="type-badge-len">{{ typeParts(col).length }}</span>
            </template>
          </span>
        </span>
        <span
          v-if="show.columnNotNull"
          class="has-tip relative col-attr col-null"
          :class="col.nn ? 'is-nn' : 'is-n'"
          :aria-label="nullTitle(col)"
        >
          {{ nullLabel(col) }}
          <HoverTip side="top">{{ nullTitle(col) }}</HoverTip>
        </span>
        <span
          v-if="show.columnDefault"
          class="col-attr col-default"
          :class="{ 'is-empty': !col.defaultValue }"
          :title="col.defaultValue"
          >{{ col.defaultValue }}</span
        >
        <span
          v-if="show.columnComment"
          class="col-attr col-comment"
          :class="{ 'is-empty': !col.comment }"
          :title="col.comment"
          >{{ col.comment }}</span
        >
        <span v-if="showFlags" class="col-attr col-flags">
          <span
            v-if="show.columnUnique && col.unique && !col.pk"
            class="has-tip relative"
            aria-label="고유 값 — 같은 값이 두 번 들어갈 수 없어요"
          >
            UQ
            <HoverTip side="top">고유 값 — 같은 값이 두 번 들어갈 수 없어요</HoverTip>
          </span>
          <span
            v-if="show.columnAutoIncrement && col.autoIncrement"
            class="has-tip relative"
            aria-label="자동 증가 — 값을 자동으로 올려 줘요"
          >
            AI
            <HoverTip side="top">자동 증가 — 값을 자동으로 올려 줘요</HoverTip>
          </span>
        </span>
        <div v-if="editable" class="col-delete-slot">
          <button
            v-if="data.selectedColumnId === col.id"
            type="button"
            class="nodrag nopan col-delete"
            title="컬럼 삭제"
            aria-label="컬럼 삭제"
            @click.stop="removeColumn(col.id)"
          >
            <Trash2 />
          </button>
        </div>
      <Handle
        :id="`${col.id}-right`"
        type="source"
        :position="Position.Right"
      />
      </div>
    </div>
    <button
      v-if="editable"
      type="button"
      class="nodrag nopan table-add-col"
      @click.stop="addColumn"
    >
      + 컬럼
    </button>
  </div>
</template>
