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

const columnName = (table: ErdTable | undefined, id: string) =>
  table?.columns.find((col) => col.id === id)?.physicalName || id

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
    <p class="text-[13px] font-bold tracking-[-0.02em]">관계</p>
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
          @update:model-value="patch({ kind: String($event) as RelationKind })"
        >
          <option value="identifying">식별</option>
          <option value="non-identifying">비식별</option>
        </Select>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <Label>삭제 시</Label>
          <Select
            :model-value="relation.onDelete ?? ''"
            @update:model-value="setAction('onDelete', String($event))"
          >
            <option value="">기본값</option>
            <option v-for="action in REFERENTIAL_ACTIONS" :key="action" :value="action">
              {{ action }}
            </option>
          </Select>
        </div>
        <div class="space-y-1">
          <Label>수정 시</Label>
          <Select
            :model-value="relation.onUpdate ?? ''"
            @update:model-value="setAction('onUpdate', String($event))"
          >
            <option value="">기본값</option>
            <option v-for="action in REFERENTIAL_ACTIONS" :key="action" :value="action">
              {{ action }}
            </option>
          </Select>
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
