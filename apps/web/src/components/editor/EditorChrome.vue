<script setup lang="ts">
import PresenceAvatars from '@/components/editor/PresenceAvatars.vue'
import ExportMenu from '@/components/editor/ExportMenu.vue'
import EditorOverflowMenu from '@/components/editor/EditorOverflowMenu.vue'
import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import SegmentedControl from '@/components/ui/segmented-control/SegmentedControl.vue'
import {
  connectionStatusLabel,
  syncStatusLabel,
  type CollabConnectionStatus,
  type CollabSyncStatus,
} from '@/lib/collab-status'
import { computed } from 'vue'

const props = defineProps<{
  projectName: string
  connectionStatus: CollabConnectionStatus
  syncStatus: CollabSyncStatus
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
  reconnect: []
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

const connLabel = computed(() => connectionStatusLabel(props.connectionStatus))
const syncLabel = computed(() => syncStatusLabel(props.syncStatus))
const statusTone = computed(() => {
  switch (props.connectionStatus) {
    case 'connected':
      return props.syncStatus === 'syncing' ? 'syncing' : 'ok'
    case 'connecting':
      return 'pending'
    case 'auth_failed':
    case 'disconnected':
      return 'bad'
    default:
      return 'muted'
  }
})
const statusText = computed(() => {
  if (props.connectionStatus === 'connected') {
    return `${connLabel.value} · ${syncLabel.value}`
  }
  if (props.connectionStatus === 'connecting') return connLabel.value
  if (props.connectionStatus === 'idle') return syncLabel.value
  return `${connLabel.value} · ${syncLabel.value}`
})
</script>

<template>
  <header
    ref="headerRef"
    class="erd-chrome erd-chrome-top pointer-events-auto relative z-30 flex min-h-14 items-center justify-between gap-2 overflow-visible border-b border-border/80 bg-card px-3 pt-[env(safe-area-inset-top)] sm:min-h-16 sm:px-4"
  >
    <div class="flex min-w-0 flex-1 items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        class="h-9 min-h-9 shrink-0 px-2.5 xl:h-8 xl:min-h-8"
        @click="emit('back')"
        >목록</Button
      >
      <Input
        :model-value="projectName"
        class="h-9 min-w-0 flex-1 bg-muted px-2.5 text-[16px] font-semibold tracking-[-0.02em] sm:w-44 sm:flex-none sm:text-base sm:font-medium xl:w-64"
        :disabled="readOnly"
        :title="projectName"
        aria-label="프로젝트 제목"
        @update:model-value="emit('update:projectName', String($event))"
        @change="emit('rename')"
      />
      <span
        class="inline-flex shrink-0 items-center gap-1.5 rounded-full p-1.5 sm:max-w-none sm:px-2 sm:py-0.5"
        :class="{
          'bg-[var(--editor-connected-bg)]': statusTone === 'ok',
          'bg-muted': statusTone === 'pending' || statusTone === 'muted',
          'bg-[var(--editor-syncing-bg)]': statusTone === 'syncing',
          'bg-[var(--editor-offline-bg)]': statusTone === 'bad',
        }"
        :title="statusText"
        :aria-label="statusText"
        role="status"
      >
        <span
          class="size-2 shrink-0 rounded-full"
          :class="{
            'bg-[var(--editor-connected-dot)] shadow-[0_0_0_3px_var(--editor-connected-ring)]':
              statusTone === 'ok',
            'animate-pulse bg-[var(--editor-connecting-dot)]':
              statusTone === 'pending' || statusTone === 'syncing',
            'bg-muted-foreground': statusTone === 'muted',
            'bg-[var(--editor-offline-dot)]': statusTone === 'bad',
          }"
          aria-hidden="true"
        />
        <span
          class="hidden truncate text-[12px] font-semibold tracking-[-0.01em] sm:inline"
          :class="{
            'text-[var(--editor-connected-fg)]': statusTone === 'ok',
            'text-muted-foreground':
              statusTone === 'pending' ||
              statusTone === 'muted' ||
              statusTone === 'syncing',
            'text-[var(--editor-offline-fg)]': statusTone === 'bad',
          }"
          >{{ statusText }}</span
        >
      </span>
      <Badge v-if="readOnly" class="inline-flex shrink-0">읽기 전용</Badge>
    </div>
    <div class="flex shrink-0 items-center gap-1.5 sm:gap-2">
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
