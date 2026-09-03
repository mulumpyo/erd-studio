<script setup lang="ts">
import { DialogRoot } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import {
  ERD_SHOW_OPTIONS,
  type ErdShowKey,
  type ErdViewPatch,
  type ErdViewSettings,
  type NameMode,
} from '@erd-studio/shared'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import Label from '@/components/ui/label/Label.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import SegmentedControl from '@/components/ui/segmented-control/SegmentedControl.vue'

const props = defineProps<{
  open: boolean
  name: string
  description: string
  tags: string[]
  view: ErdViewSettings
  readOnly?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'save-meta', payload: { name: string; description: string; tags: string[] }): void
  (e: 'update-view', patch: ErdViewPatch): void
}>()

const name = ref(props.name)
const description = ref(props.description)
const tags = ref<string[]>([...props.tags])
const tagDraft = ref('')

const nameModes = [
  { value: 'both', label: '논리/물리' },
  { value: 'logical', label: '논리명' },
  { value: 'physical', label: '물리명' },
]

watch(
  () => props.open,
  (open) => {
    if (!open) return
    name.value = props.name
    description.value = props.description
    tags.value = [...props.tags]
    tagDraft.value = ''
  },
)

const addTag = (raw: string) => {
  const tag = raw.trim().replace(/^#/, '').slice(0, 24)
  if (!tag) return
  if (tags.value.some((item) => item.toLowerCase() === tag.toLowerCase())) {
    tagDraft.value = ''
    return
  }
  if (tags.value.length >= 12) return
  tags.value = [...tags.value, tag]
  tagDraft.value = ''
}

const removeTag = (tag: string) => {
  tags.value = tags.value.filter((item) => item !== tag)
}

const onTagKey = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    addTag(tagDraft.value)
  }
  if (event.key === 'Backspace' && !tagDraft.value && tags.value.length) {
    tags.value = tags.value.slice(0, -1)
  }
}

const dirty = computed(
  () =>
    name.value.trim() !== props.name ||
    description.value !== props.description ||
    tags.value.join('\0') !== props.tags.join('\0'),
)

const saveMeta = () => {
  if (props.readOnly) return
  addTag(tagDraft.value)
  emit('save-meta', {
    name: name.value.trim() || props.name,
    description: description.value.trim(),
    tags: tags.value,
  })
}

const close = (next: boolean) => {
  if (!next && dirty.value && !props.readOnly) saveMeta()
  emit('update:open', next)
}

const toggleShow = (key: ErdShowKey, on: boolean) => {
  emit('update-view', { show: { [key]: on } })
}
</script>

<template>
  <DialogRoot :open="open" @update:open="close">
    <DialogContent class="max-w-xl">
      <template #header>
        <DialogTitle>프로젝트 설정</DialogTitle>
      </template>
      <section class="space-y-3">
        <p class="text-[13px] font-bold tracking-[-0.02em]">기본 정보</p>
        <div class="space-y-1">
          <Label>이름</Label>
          <Input v-model="name" :disabled="readOnly" />
        </div>
        <div class="space-y-1">
          <Label>설명</Label>
          <Textarea
            v-model="description"
            class="min-h-20"
            :disabled="readOnly"
            placeholder="이 다이어그램이 다루는 내용을 적어 주세요"
          />
        </div>
        <div class="space-y-1">
          <Label>태그</Label>
          <div
            class="flex min-h-12 flex-wrap items-center gap-1.5 rounded-xl bg-muted px-3 py-2"
            :class="readOnly && 'opacity-50'"
          >
            <button
              v-for="tag in tags"
              :key="tag"
              type="button"
              class="rounded-full bg-card px-2.5 py-1 text-[12px] font-semibold text-primary"
              :disabled="readOnly"
              @click="!readOnly && removeTag(tag)"
            >
              #{{ tag }}
            </button>
            <input
              v-if="!readOnly"
              v-model="tagDraft"
              class="min-w-[8rem] flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
              placeholder="태그 입력 후 Enter"
              @keydown="onTagKey"
              @blur="addTag(tagDraft)"
            />
          </div>
        </div>
        <Button
          v-if="!readOnly"
          size="sm"
          :disabled="!dirty"
          @click="saveMeta"
          >기본 정보 저장</Button
        >
      </section>
      <section class="space-y-3">
        <div>
          <p class="text-[13px] font-bold tracking-[-0.02em]">다이어그램 표시</p>
          <p class="mt-1 text-[13px] text-muted-foreground">
            테이블에 어떤 컬럼 정보를 그릴지 골라 주세요. ERD Cloud처럼 필요한
            항목만 켜면 돼요.
          </p>
        </div>
        <SegmentedControl
          class="w-full"
          :model-value="view.nameMode"
          :options="nameModes"
          @update:model-value="
            emit('update-view', { nameMode: $event as NameMode })
          "
        />
        <ul class="grid gap-2 sm:grid-cols-2">
          <li
            v-for="option in ERD_SHOW_OPTIONS"
            :key="option.key"
            class="flex items-start gap-2.5 rounded-2xl bg-muted/70 px-3 py-2.5"
          >
            <Checkbox
              class="mt-0.5"
              :checked="view.show[option.key]"
              @update:checked="toggleShow(option.key, $event)"
            />
            <button
              type="button"
              class="min-w-0 text-left"
              @click="toggleShow(option.key, !view.show[option.key])"
            >
              <span class="block text-[14px] font-semibold tracking-[-0.02em]">{{
                option.label
              }}</span>
              <span class="block text-[12px] text-muted-foreground">{{
                option.hint
              }}</span>
            </button>
          </li>
        </ul>
      </section>
    </DialogContent>
  </DialogRoot>
</template>
