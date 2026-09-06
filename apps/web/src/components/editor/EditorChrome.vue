<script setup lang="ts">
import PresenceAvatars from '@/components/editor/PresenceAvatars.vue'
import ExportMenu from '@/components/editor/ExportMenu.vue'
import EditorOverflowMenu from '@/components/editor/EditorOverflowMenu.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import SegmentedControl from '@/components/ui/segmented-control/SegmentedControl.vue'

defineProps<{
  projectName: string
  connected: boolean
  readOnly?: boolean
  peers: Array<{ id?: string; name: string; color: string; self?: boolean }>
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
  'update:projectName': [value: string]
  rename: []
  back: []
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

const headerRef = defineModel<HTMLElement | null>('headerEl', {
  default: null,
})
</script>

<template>
  <header
    ref="headerRef"
    class="erd-chrome erd-chrome-top pointer-events-auto relative z-30 flex min-h-16 items-center justify-between gap-2 overflow-visible border-b border-border/80 bg-card px-3 pt-[env(safe-area-inset-top)] sm:px-4"
  >
    <div class="flex min-w-0 items-center gap-2 sm:gap-3">
      <Button
        variant="secondary"
        size="sm"
        class="min-h-11 px-3 xl:min-h-8"
        @click="emit('back')"
        >목록</Button
      >
      <Input
        :model-value="projectName"
        class="h-10 min-w-0 flex-1 bg-muted text-base sm:w-40 sm:flex-none xl:w-56"
        :disabled="readOnly"
        @update:model-value="emit('update:projectName', String($event))"
        @change="emit('rename')"
      />
      <span
        class="inline-flex shrink-0 items-center gap-1.5 rounded-full xl:px-2.5 xl:py-0.5"
        :class="connected ? 'xl:bg-[var(--editor-connected-bg)]' : 'xl:bg-muted'"
        :title="connected ? '연결됨' : '연결 중'"
        :aria-label="connected ? '연결됨' : '연결 중'"
      >
        <span
          class="size-2.5 rounded-full"
          :class="
            connected
              ? 'bg-[var(--editor-connected-dot)] shadow-[0_0_0_3px_var(--editor-connected-ring)]'
              : 'animate-pulse bg-[var(--editor-connecting-dot)]'
          "
        />
        <span
          class="hidden text-[12px] font-semibold tracking-[-0.01em] xl:inline"
          :class="
            connected
              ? 'text-[var(--editor-connected-fg)]'
              : 'text-muted-foreground'
          "
          >{{ connected ? '연결됨' : '연결 중' }}</span
        >
      </span>
      <Badge v-if="readOnly" class="hidden sm:inline-flex">읽기 전용</Badge>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <PresenceAvatars :users="peers" />
      <div class="hidden items-center gap-2 xl:flex">
        <ExportMenu
          @png="emit('png')"
          @svg="emit('svg')"
          @html="emit('html')"
          @csv="emit('csv')"
          @xls="emit('xls')"
          @json="emit('json')"
          @import-json="emit('import-json', $event)"
        />
        <Button
          v-if="showTeamManage"
          variant="secondary"
          size="sm"
          @click="emit('manage-team')"
          >나의 팀</Button
        >
        <Button
          v-else-if="isParticipant"
          variant="secondary"
          size="sm"
          @click="emit('members')"
          >팀원</Button
        >
        <SegmentedControl
          v-if="isOwner"
          :model-value="isPublic ? 'public' : 'private'"
          :options="shareOptions"
          @update:model-value="emit('update:public', $event === 'public')"
        />
        <Button size="sm" variant="secondary" @click="emit('copy-share')"
          >링크 복사</Button
        >
        <Button v-if="!signedIn" size="sm" @click="emit('login')"
          >로그인</Button
        >
        <Button
          v-if="canDelete"
          variant="destructive"
          size="sm"
          @click="emit('remove')"
          >삭제</Button
        >
        <Button
          v-else-if="canLeave"
          variant="ghost"
          size="sm"
          @click="emit('leave')"
          >나가기</Button
        >
      </div>
      <EditorOverflowMenu
        :is-owner="isOwner"
        :is-participant="isParticipant"
        :can-delete="canDelete"
        :can-leave="canLeave"
        :is-public="isPublic"
        :signed-in="signedIn"
        :show-team-manage="showTeamManage"
        :share-options="shareOptions"
        @members="emit('members')"
        @manage-team="emit('manage-team')"
        @update:public="emit('update:public', $event)"
        @copy-share="emit('copy-share')"
        @login="emit('login')"
        @remove="emit('remove')"
        @leave="emit('leave')"
        @png="emit('png')"
        @svg="emit('svg')"
        @html="emit('html')"
        @csv="emit('csv')"
        @xls="emit('xls')"
        @json="emit('json')"
        @import-json="emit('import-json', $event)"
      />
    </div>
  </header>
</template>
