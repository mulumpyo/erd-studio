<script setup lang="ts">
import { DialogRoot } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Button from '@/components/ui/button/Button.vue'
import FieldBar from '@/components/ui/field-bar/FieldBar.vue'
import Input from '@/components/ui/input/Input.vue'
import Select from '@/components/ui/select/Select.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import { api } from '@/api'
import { errorMessage, roleLabel } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/composables/useToast'
import { confirm } from '@/composables/useConfirm'
import type { PendingInvitation } from '@/types/workspace'

export type ProjectMember = {
  userId: string
  role: string
  user: { id: string; name: string; email: string }
}

type MembersResponse = {
  kind: 'team' | 'project'
  team: { id: string; name: string; ownerId: string } | null
  members: ProjectMember[]
  invitations?: PendingInvitation[]
}

const PAGE_SIZE = 8

const props = defineProps<{
  open: boolean
  projectId: string
  ownerId?: string
  isPublic?: boolean
}>()
const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'acl', payload: { userId: string; role: string | null }): void
}>()
const auth = useAuthStore()
const router = useRouter()
const kind = ref<'team' | 'project'>('project')
const team = ref<MembersResponse['team']>(null)
const members = ref<ProjectMember[]>([])
const invitations = ref<PendingInvitation[]>([])
const email = ref('')
const role = ref('editor')
const roleOptions = [
  { value: 'editor', label: '편집' },
  { value: 'viewer', label: '보기' },
]
const error = ref('')
const loading = ref(false)
const query = ref('')
const page = ref(1)

const isTeamProject = computed(() => kind.value === 'team')
const canManageTeam = computed(
  () => Boolean(auth.user?.id && team.value?.ownerId === auth.user.id),
)
const canManage = computed(
  () =>
    !isTeamProject.value &&
    (auth.user?.id === props.ownerId ||
      members.value.some(
        (m) => m.userId === auth.user?.id && m.role === 'owner',
      )),
)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return members.value
  return members.value.filter(
    (m) =>
      m.user.name.toLowerCase().includes(q) ||
      m.user.email.toLowerCase().includes(q),
  )
})

const pageCount = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)),
)

const paged = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filtered.value.slice(start, start + PAGE_SIZE)
})

const rangeLabel = computed(() => {
  if (!filtered.value.length) return '0명'
  const start = (page.value - 1) * PAGE_SIZE + 1
  const end = Math.min(page.value * PAGE_SIZE, filtered.value.length)
  return `${start}–${end} / ${filtered.value.length}명`
})

const load = async () => {
  const data = await api<MembersResponse>(
    `/api/projects/${props.projectId}/members`,
    {},
    auth.token,
  )
  kind.value = data.kind
  team.value = data.team
  members.value = data.members
  invitations.value = data.invitations ?? []
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    query.value = ''
    page.value = 1
    email.value = ''
    error.value = ''
    await load()
  },
)

watch(query, () => {
  page.value = 1
})

watch(pageCount, (count) => {
  if (page.value > count) page.value = count
})

const copyInvite = async (url: string) => {
  await navigator.clipboard.writeText(url)
  toast('초대 링크를 복사했어요')
}

const invite = async () => {
  error.value = ''
  loading.value = true
  try {
    const result = await api<
      | { status: 'joined'; member: ProjectMember }
      | { status: 'invited'; mailed: boolean }
    >(
      `/api/projects/${props.projectId}/members`,
      {
        method: 'POST',
        body: JSON.stringify({ email: email.value, role: role.value }),
      },
      auth.token,
    )
    email.value = ''
    if (result.status === 'joined') {
      emit('acl', { userId: result.member.userId, role: result.member.role })
      toast('멤버로 추가했어요')
    } else {
      toast(
        result.mailed
          ? '초대 메일을 보냈어요'
          : '아직 가입하지 않은 분이에요. 링크를 복사해 초대해 주세요.',
      )
    }
    await load()
  } catch (e) {
    error.value = errorMessage(e, '초대하지 못했어요')
  } finally {
    loading.value = false
  }
}

const resendInvite = async (id: string) => {
  error.value = ''
  try {
    const result = await api<{ mailed: boolean }>(
      `/api/projects/${props.projectId}/invitations/${id}/resend`,
      { method: 'POST' },
      auth.token,
    )
    toast(result.mailed ? '초대 메일을 다시 보냈어요' : '초대 링크를 갱신했어요')
    await load()
  } catch (e) {
    error.value = errorMessage(e, '다시 보내지 못했어요')
  }
}

const revokeInvite = async (id: string, email: string) => {
  const ok = await confirm({
    title: '초대를 취소할까요?',
    description: `${email}님에게 보낸 초대가 무효가 돼요.`,
    confirmLabel: '초대 취소',
    destructive: true,
  })
  if (!ok) return
  error.value = ''
  try {
    await api(
      `/api/projects/${props.projectId}/invitations/${id}`,
      { method: 'DELETE' },
      auth.token,
    )
    await load()
  } catch (e) {
    error.value = errorMessage(e, '초대를 취소하지 못했어요')
  }
}

const changeRole = async (userId: string, nextRole: string) => {
  await api(
    `/api/projects/${props.projectId}/members/${userId}`,
    { method: 'PATCH', body: JSON.stringify({ role: nextRole }) },
    auth.token,
  )
  emit('acl', { userId, role: nextRole })
  await load()
}

const remove = async (userId: string, name: string) => {
  const ok = await confirm({
    title: `${name}님을 뺄까요?`,
    description: '이 다이어그램을 더 이상 보지 못해요.',
    confirmLabel: '빼기',
    destructive: true,
  })
  if (!ok) return
  await api(
    `/api/projects/${props.projectId}/members/${userId}`,
    { method: 'DELETE' },
    auth.token,
  )
  emit('acl', { userId, role: null })
  await load()
}

const goTeam = () => {
  emit('update:open', false)
  router.push('/app')
}
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <template #header>
        <DialogTitle>
          {{ isTeamProject ? '팀 멤버' : '프로젝트 멤버' }}
        </DialogTitle>
      </template>
      <p v-if="isTeamProject" class="text-[15px] text-muted-foreground">
        {{ team?.name }}
        {{
          canManageTeam
            ? '팀 프로젝트예요. 멤버는 팀에서 관리해요.'
            : '팀과 함께 보고 있어요.'
        }}
      </p>
      <p v-else class="text-[15px] text-muted-foreground">
        멤버는 팀에서 관리해요. 대시보드의 팀 설정으로 이동해 주세요.
      </p>
      <p
        v-if="isPublic"
        class="text-[15px] text-muted-foreground"
      >
        공개 중이에요. 링크만 있으면 누구나 볼 수 있어서, 보기 권한은 비공개일
        때만 필요해요. 같이 편집할 사람만 멤버로 두세요.
      </p>
      <FieldBar v-if="canManage">
        <Input
          v-model="email"
          placeholder="이메일 주소"
          class="h-10 min-w-0 flex-1 bg-transparent px-0 focus-visible:bg-transparent focus-visible:ring-0"
          aria-label="초대 이메일"
          @keydown.enter.prevent="invite"
        />
        <Select
          v-model="role"
          class="h-10 w-[7.5rem] px-3 text-[13px]"
          :options="roleOptions"
        />
        <Button class="h-10 shrink-0 px-4" :disabled="loading" @click="invite"
          >초대</Button
        >
      </FieldBar>
      <Input
        v-if="members.length > 5"
        v-model="query"
        placeholder="이름 또는 이메일로 찾기"
      />
      <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
      <ul v-if="canManage && invitations.length" class="min-w-0 space-y-2">
        <li
          v-for="pending in invitations"
          :key="pending.id"
          class="min-w-0 overflow-hidden rounded-2xl bg-muted px-3 py-2.5"
        >
          <div class="flex min-w-0 items-center gap-2">
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium">{{ pending.email }}</div>
              <div class="text-xs text-muted-foreground">초대 대기</div>
            </div>
            <Badge class="shrink-0">{{ roleLabel(pending.role) }}</Badge>
          </div>
          <div class="mt-2 flex flex-wrap justify-end gap-1">
            <Button
              v-if="pending.inviteUrl"
              variant="ghost"
              size="sm"
              @click="pending.inviteUrl && copyInvite(pending.inviteUrl)"
            >
              링크
            </Button>
            <Button variant="ghost" size="sm" @click="resendInvite(pending.id)">
              재발송
            </Button>
            <Button
              variant="ghostDestructive"
              size="sm"
              @click="revokeInvite(pending.id, pending.email)"
            >
              취소
            </Button>
          </div>
        </li>
      </ul>
      <ul class="min-w-0 max-h-72 space-y-2 overflow-auto">
        <li
          v-if="!paged.length"
          class="rounded-2xl bg-muted px-3 py-8 text-center text-[14px] text-muted-foreground"
        >
          {{ query ? '찾는 멤버가 없어요.' : '아직 멤버가 없어요.' }}
        </li>
        <li
          v-for="m in paged"
          :key="m.userId"
          class="min-w-0 overflow-hidden rounded-2xl bg-muted px-3 py-2.5"
        >
          <div class="flex min-w-0 items-center gap-2">
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium">{{ m.user.name }}</div>
              <div class="truncate text-xs text-muted-foreground">
                {{ m.user.email }}
              </div>
            </div>
            <Badge class="shrink-0">{{ roleLabel(m.role) }}</Badge>
          </div>
          <div
            v-if="canManage && m.userId !== ownerId"
            class="mt-2 flex flex-wrap items-center justify-end gap-1"
          >
            <Select
              :model-value="m.role"
              class="min-h-11 min-w-[6.5rem] w-auto px-3 text-[13px]"
              :options="roleOptions"
              @update:model-value="changeRole(m.userId, String($event))"
            />
            <Button
              variant="ghostDestructive"
              size="sm"
              @click="remove(m.userId, m.user.name)"
            >
              빼기
            </Button>
          </div>
        </li>
      </ul>
      <div
        v-if="filtered.length > PAGE_SIZE"
        class="flex items-center justify-between"
      >
        <span class="text-[13px] text-muted-foreground">{{ rangeLabel }}</span>
        <div class="flex gap-1">
          <Button
            size="sm"
            variant="secondary"
            :disabled="page <= 1"
            @click="page -= 1"
          >
            이전
          </Button>
          <Button
            size="sm"
            variant="secondary"
            :disabled="page >= pageCount"
            @click="page += 1"
          >
            다음
          </Button>
        </div>
      </div>
      <Button
        v-if="isTeamProject && canManageTeam"
        variant="secondary"
        size="sm"
        @click="goTeam"
      >
        팀에서 멤버 관리
      </Button>
    </DialogContent>
  </DialogRoot>
</template>
