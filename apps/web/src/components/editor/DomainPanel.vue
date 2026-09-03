<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  COLUMN_TYPES,
  defaultDomain,
  type ErdDomain,
} from '@erd-studio/shared'
import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import Input from '@/components/ui/input/Input.vue'
import Select from '@/components/ui/select/Select.vue'
import HoverTip from '@/components/ui/hover-tip/HoverTip.vue'

const props = defineProps<{
  domains: ErdDomain[]
  readOnly?: boolean
}>()
const emit = defineEmits<{
  add: [domain: ErdDomain]
  update: [domain: ErdDomain]
  remove: [id: string]
}>()

const query = ref('')
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.domains
  return props.domains.filter((d) => d.name.toLowerCase().includes(q))
})

const patch = (domain: ErdDomain, partial: Partial<ErdDomain>) => {
  if (props.readOnly) return
  emit('update', { ...domain, ...partial })
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <Input
        v-model="query"
        class="h-12 min-w-0 flex-1 bg-card ring-1 ring-border"
        placeholder="도메인 찾기"
      />
      <Button
        class="h-12 shrink-0 px-4"
        variant="secondary"
        :disabled="readOnly"
        @click="emit('add', defaultDomain())"
        >추가</Button
      >
    </div>
    <p v-if="!domains.length" class="text-xs text-muted-foreground">
      컬럼 타입을 한곳에서 관리할 수 있어요.
    </p>
    <div
      v-for="domain in filtered"
      :key="domain.id"
      class="space-y-2 rounded-2xl bg-card p-3"
    >
      <Input
        :model-value="domain.name"
        :disabled="readOnly"
        placeholder="도메인명"
        @change="
          patch(domain, { name: ($event.target as HTMLInputElement).value })
        "
      />
      <div class="grid grid-cols-2 gap-2">
        <Select
          :model-value="domain.type"
          :disabled="readOnly"
          @update:model-value="patch(domain, { type: String($event) })"
        >
          <option v-for="t in COLUMN_TYPES" :key="t" :value="t">{{ t }}</option>
        </Select>
        <Input
          :model-value="domain.length"
          :disabled="readOnly"
          placeholder="길이"
          @change="
            patch(domain, { length: ($event.target as HTMLInputElement).value })
          "
        />
      </div>
      <div class="flex items-center justify-between text-xs">
        <label
          class="has-tip relative flex items-center gap-1.5 text-[13px] font-semibold"
        >
          <Checkbox
            :checked="domain.nn"
            :disabled="readOnly"
            @update:checked="patch(domain, { nn: $event })"
          />
          NN
          <HoverTip side="top">NULL 불가 — 비워 둘 수 없어요</HoverTip>
        </label>
        <Button
          variant="ghostDestructive"
          size="sm"
          :disabled="readOnly"
          @click="emit('remove', domain.id)"
          >삭제</Button
        >
      </div>
    </div>
  </div>
</template>
