<script setup lang="ts">
import { ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { ChevronRight, MoreHorizontal } from 'lucide-vue-next'
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
const exportOpen = ref(false)
const root = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

onClickOutside(root, () => {
  open.value = false
  exportOpen.value = false
})

const itemClass =
  'block w-full px-4 py-2.5 text-left text-[14px] font-medium hover:bg-muted'

const subItemClass =
  'block w-full px-4 py-2.5 pl-8 text-left text-[14px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground'

const close = () => {
  open.value = false
  exportOpen.value = false
}

const toggleMenu = () => {
  open.value = !open.value
  if (!open.value) exportOpen.value = false
}

const pick = (kind: 'png' | 'svg' | 'html' | 'csv' | 'xls' | 'json') => {
  close()
  if (kind === 'png') emit('png')
  else if (kind === 'svg') emit('svg')
  else if (kind === 'html') emit('html')
  else if (kind === 'csv') emit('csv')
  else if (kind === 'xls') emit('xls')
  else emit('json')
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
  if (name === 'members') emit('members')
  else if (name === 'manage-team') emit('manage-team')
  else if (name === 'copy-share') emit('copy-share')
  else if (name === 'login') emit('login')
  else if (name === 'remove') emit('remove')
  else emit('leave')
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
      @click="toggleMenu"
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
      class="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-2xl bg-card py-2 text-card-foreground shadow-[0_12px_32px_rgb(28_25_23_/_0.12)]"
    >
      <div class="max-h-[min(28rem,calc(100vh-5.5rem))] overflow-y-auto">
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
        <template v-if="showTeamManage || isParticipant">
          <div class="my-1 h-px bg-border" />
          <button
            v-if="showTeamManage"
            type="button"
            :class="itemClass"
            @click="run('manage-team')"
          >
            나의 팀
          </button>
          <button
            v-else
            type="button"
            :class="itemClass"
            @click="run('members')"
          >
            팀원 관리
          </button>
        </template>
        <div class="my-1 h-px bg-border" />
        <button
          type="button"
          :class="[itemClass, 'flex items-center justify-between gap-2']"
          :aria-expanded="exportOpen"
          @click="exportOpen = !exportOpen"
        >
          <span>내보내기</span>
          <ChevronRight
            class="size-4 shrink-0 text-muted-foreground transition-transform"
            :class="exportOpen ? 'rotate-90' : ''"
            aria-hidden="true"
          />
        </button>
        <div v-if="exportOpen" role="group" aria-label="내보내기 형식">
          <button type="button" :class="subItemClass" @click="pick('json')">
            ERD JSON
          </button>
          <button type="button" :class="subItemClass" @click="pick('png')">
            PNG
          </button>
          <button type="button" :class="subItemClass" @click="pick('svg')">
            SVG
          </button>
          <button type="button" :class="subItemClass" @click="pick('html')">
            HTML 명세서
          </button>
          <button type="button" :class="subItemClass" @click="pick('xls')">
            Excel
          </button>
          <button type="button" :class="subItemClass" @click="pick('csv')">
            CSV
          </button>
        </div>
        <button type="button" :class="itemClass" @click="pickImport">
          ERD JSON 가져오기
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
            :class="[itemClass, 'text-destructive hover:bg-[var(--editor-danger-hover)]']"
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
