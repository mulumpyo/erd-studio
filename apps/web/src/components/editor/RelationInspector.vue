<script setup lang="ts">
import {
  REFERENTIAL_ACTIONS,
  type ErdRelation,
  type ErdTable,
  type ReferentialAction,
  type RelationKind,
} from '@erd-studio/shared'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import Select from '@/components/ui/select/Select.vue'

const props = defineProps<{
  relation: ErdRelation
  tables: ErdTable[]
  readOnly?: boolean
}>()

const emit = defineEmits<{
  update: [relation: ErdRelation]
  remove: []
}>()

const source = () =>
  props.tables.find((table) => table.id === props.relation.sourceTableId)
const target = () =>
  props.tables.find((table) => table.id === props.relation.targetTableId)

const columnName = (table: ErdTable | undefined, id: string) => {
  const col = table?.columns.find((column) => column.id === id)
  return col?.physicalName || col?.logicalName || id
}

const kindOptions = [
  { value: 'identifying', label: '식별' },
  { value: 'non-identifying', label: '비식별' },
]
const actionOptions = [
  { value: '', label: '기본값' },
  ...REFERENTIAL_ACTIONS.map((action) => ({ value: action, label: action })),
]

const patch = (partial: Partial<ErdRelation>) => {
  if (props.readOnly) return
  const next: ErdRelation = { ...props.relation, ...partial }
  if (!next.onDelete) delete next.onDelete
  if (!next.onUpdate) delete next.onUpdate
  if (!next.name) delete next.name
  emit('update', next)
}

const setAction = (
  key: 'onDelete' | 'onUpdate',
  value: string,
) => {
  patch({
    [key]: (value || undefined) as ReferentialAction | undefined,
  })
}
</script>

<template>
  <div class="mb-4 space-y-3 rounded-2xl bg-muted p-4">
    <p class="text-[13px] font-bold tracking-[-0.01em]">관계</p>
    <p class="text-[13px] leading-5 text-muted-foreground">
      {{ source()?.logicalName || '부모' }}
      →
      {{ target()?.logicalName || '자식' }}
    </p>
    <fieldset :disabled="readOnly" class="space-y-3">
      <div class="space-y-1">
        <Label>제약 이름</Label>
        <Input
          :model-value="relation.name ?? ''"
          placeholder="fk_child_parent"
          @change="
            patch({ name: ($event.target as HTMLInputElement).value.trim() })
          "
        />
      </div>
      <div class="space-y-1">
        <Label>관계 종류</Label>
        <Select
          :model-value="relation.kind"
          :options="kindOptions"
          @update:model-value="patch({ kind: String($event) as RelationKind })"
        />
        <p class="text-[12px] leading-5 text-muted-foreground">
          <template v-if="relation.kind === 'identifying'">
            식별(실선): 자식 테이블 기본 키에 부모 키가 포함돼요.
          </template>
          <template v-else>
            비식별(점선): 자식에는 외래 키만 두고, 기본 키는 따로 가져요.
          </template>
        </p>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label>삭제 시</Label>
          <Select
            :model-value="relation.onDelete ?? ''"
            :options="actionOptions"
            @update:model-value="setAction('onDelete', String($event))"
          />
        </div>
        <div class="space-y-1">
          <Label>수정 시</Label>
          <Select
            :model-value="relation.onUpdate ?? ''"
            :options="actionOptions"
            @update:model-value="setAction('onUpdate', String($event))"
          />
        </div>
      </div>
      <p class="text-[12px] leading-5 text-muted-foreground">
        SQL로 내보낼 때 ON DELETE / ON UPDATE로 들어가요. CASCADE는 부모 행을
        지우면 자식도 같이 지워요.
      </p>
      <ul class="space-y-1 text-[13px]">
        <li
          v-for="(sourceId, index) in relation.sourceColumnIds"
          :key="sourceId"
          class="rounded-xl bg-card px-3 py-2 font-mono text-[12px]"
        >
          {{ columnName(source(), sourceId) }}
          →
          {{ columnName(target(), relation.targetColumnIds[index] ?? '') }}
        </li>
      </ul>
      <Button variant="destructive" class="w-full" @click="emit('remove')"
        >관계 삭제</Button
      >
    </fieldset>
  </div>
</template>
