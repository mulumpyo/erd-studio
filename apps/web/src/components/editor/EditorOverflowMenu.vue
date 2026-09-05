<script setup lang="ts">
import { ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { MoreHorizontal } from 'lucide-vue-next'
import Button from '@/components/ui/button/Button.vue'
import SegmentedControl from '@/components/ui/segmented-control/SegmentedControl.vue'

defineProps<{
  isOwner?: boolean
  isParticipant?: boolean
  canDelete?: boolean
  canLeave?: boolean
  isPublic?: boolean
  signedIn?: boolean
  showTeamManage?: boolean
  shareOptions: Array<{ value: string; label: string }>
}>()

const emit = defineEmits<{
  members: []
  'manage-team': []
  'update:public': [value: boolean]
  'copy-share': []
  login: []
  remove: []
  leave: []
  png: []
  svg: []
  html: []
  csv: []
  xls: []
  json: []
  'import-json': [file: File]
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

onClickOutside(root, () => {
  open.value = false
})

const itemClass =
  'block w-full px-4 py-2.5 text-left text-[14px] font-medium hover:bg-muted'

const close = () => {
  open.value = false
}

const pick = (
  kind: 'png' | 'svg' | 'html' | 'csv' | 'xls' | 'json',
) => {
  close()
  emit(kind)
}

const pickImport = () => {
  close()
  fileInput.value?.click()
}

const onFile = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) emit('import-json', file)
}

const run = (
  name: 'members' | 'manage-team' | 'copy-share' | 'login' | 'remove' | 'leave',
) => {
  close()
  emit(name)
}
</script>

<template>
  <div ref="root" class="relative xl:hidden">
    <Button
      type="button"
      variant="secondary"
      size="icon"
      class="size-11"
      title="더보기"
      aria-label="더보기"
      :aria-expanded="open"
      @click="open = !open"
    >
      <MoreHorizontal />
    </Button>
    <input
      ref="fileInput"
      type="file"
      accept="application/json,.json,.erd.json"
      class="hidden"
      @change="onFile"
    />
    <div
      v-if="open"
      class="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl bg-card py-2 text-card-foreground shadow-[0_12px_32px_rgb(25_31_40_/_0.12)]"
    >
      <div
        class="max-h-[min(28rem,calc(100vh-5.5rem))] overflow-y-auto"
      >
        <button
          v-if="showTeamManage"
          type="button"
          :class="itemClass"
          @click="run('manage-team')"
        >
          팀에서 관리
        </button>
        <button
          v-else-if="isParticipant"
          type="button"
          :class="itemClass"
          @click="run('members')"
        >
          멤버
        </button>
        <div v-if="isOwner" class="px-3 py-2">
          <SegmentedControl
            class="w-full"
            :model-value="isPublic ? 'public' : 'private'"
            :options="shareOptions"
            @update:model-value="emit('update:public', $event === 'public')"
          />
        </div>
        <button type="button" :class="itemClass" @click="run('copy-share')">
          링크 복사
        </button>
        <div class="my-1 h-px bg-border" />
        <button type="button" :class="itemClass" @click="pick('json')">
          ERD JSON으로 저장
        </button>
        <button type="button" :class="itemClass" @click="pickImport">
          ERD JSON 가져오기
        </button>
        <button type="button" :class="itemClass" @click="pick('png')">
          PNG로 저장
        </button>
        <button type="button" :class="itemClass" @click="pick('svg')">
          SVG로 저장
        </button>
        <button type="button" :class="itemClass" @click="pick('html')">
          HTML 명세서로
        </button>
        <button type="button" :class="itemClass" @click="pick('xls')">
          Excel로 저장
        </button>
        <button type="button" :class="itemClass" @click="pick('csv')">
          CSV로 저장
        </button>
        <template v-if="!signedIn || canDelete || canLeave">
          <div class="my-1 h-px bg-border" />
          <button
            v-if="!signedIn"
            type="button"
            :class="itemClass"
            @click="run('login')"
          >
            로그인
          </button>
          <button
            v-if="canDelete"
            type="button"
            :class="[itemClass, 'text-destructive hover:bg-[#fff1f1] dark:hover:bg-[#3a1d22]']"
            @click="run('remove')"
          >
            삭제
          </button>
          <button
            v-else-if="canLeave"
            type="button"
            :class="itemClass"
            @click="run('leave')"
          >
            나가기
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
