<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronLeft, ChevronRight, Pencil, Plus, Search } from 'lucide-vue-next'
import { api } from '@/api'
import { errorMessage, initialOf, roleLabel } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/composables/useToast'
import { confirm } from '@/composables/useConfirm'
import { useFitPageSize } from '@/composables/usePageSize'
import {
  canDeleteProject,
  canLeaveProject,
  isProjectOwner,
  type PageResult,
  type PendingInvitation,
  type Project,
  type Team,
  type TeamMember,
} from '@/types/workspace'
import PaginationBar from '@/components/ui/pagination/PaginationBar.vue'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import CreateProjectDialog from '@/components/dashboard/CreateProjectDialog.vue'
import CreateTeamDialog from '@/components/dashboard/CreateTeamDialog.vue'
import InviteMemberDialog from '@/components/dashboard/InviteMemberDialog.vue'
import ManageMemberDialog from '@/components/dashboard/ManageMemberDialog.vue'
import FieldBar from '@/components/ui/field-bar/FieldBar.vue'
import Input from '@/components/ui/input/Input.vue'
import SegmentedControl from '@/components/ui/segmented-control/SegmentedControl.vue'

const props = defineProps<{
  team: Team
  revision?: number
}>()

const emit = defineEmits<{
  changed: []
  create: [fromSample: boolean, name: string]
  'remove-team': []
  'leave-team': []
  'remove-project': [id: string]
  'leave-project': [id: string]
}>()

const auth = useAuthStore()
const query = ref('')
const search = ref('')
const memberQuery = ref('')
const createOpen = ref(false)
const renameOpen = ref(false)
const inviteOpen = ref(false)
const inviteError = ref('')
const error = ref('')
const inviting = ref(false)
const memberOpen = ref(false)
const activeMember = ref<TeamMember | null>(null)
const memberBusy = ref(false)
const memberError = ref('')
const teamPane = ref<'projects' | 'members'>('projects')
const setTeamPane = (value: string) => {
  if (value === 'projects' || value === 'members') teamPane.value = value
}
const projects = ref<Project[]>([])
const projectPage = ref(1)
const projectPages = ref(1)
const projectTotal = ref(0)
const loadingProjects = ref(false)
const projectViewport = ref<HTMLElement | null>(null)
const memberViewport = ref<HTMLElement | null>(null)
let searchTimer = 0
let projectSizeTimer = 0
const isOwner = computed(() => props.team.ownerId === auth.user?.id)
const memberNeedle = computed(() => memberQuery.value.trim().toLowerCase())
const projectPageSize = useFitPageSize(
  projectViewport,
  () => 88,
  [teamPane],
)
const memberPageSize = useFitPageSize(
  memberViewport,
  () => 80,
  [teamPane],
)

const matchesPerson = (name: string, email: string) => {
  const q = memberNeedle.value
  if (!q) return true
  return name.toLowerCase().includes(q) || email.toLowerCase().includes(q)
}

const memberPage = ref(1)

const pendingInvites = computed(() => {
  const invites = isOwner.value ? (props.team.invitations ?? []) : []
  return invites.filter((invite) => matchesPerson('', invite.email))
})

const sortedMembers = computed(() =>
  [...props.team.members]
    .filter((m) => matchesPerson(m.user.name, m.user.email))
    .sort((a, b) => {
      if (a.userId === props.team.ownerId) return -1
      if (b.userId === props.team.ownerId) return 1
      return a.user.name.localeCompare(b.user.name, 'ko')
    }),
)

const memberRows = computed(() => [
  ...sortedMembers.value.map((member) => ({ kind: 'member' as const, member })),
  ...pendingInvites.value.map((invite) => ({ kind: 'invite' as const, invite })),
])
const memberTotal = computed(() => memberRows.value.length)
const memberPages = computed(() =>
  Math.max(1, Math.ceil(memberTotal.value / memberPageSize.value)),
)
const pagedMemberRows = computed(() => {
  const start = (memberPage.value - 1) * memberPageSize.value
  return memberRows.value.slice(start, start + memberPageSize.value)
})
const setMemberPage = (next: number) => {
  memberPage.value = next
}

const projectCount = computed(
  () => props.team._count?.projects ?? projectTotal.value,
)

const formatUpdated = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { dateStyle: 'medium' })

const loadProjects = async () => {
  loadingProjects.value = true
  try {
    const params = new URLSearchParams({
      teamId: props.team.id,
      page: String(projectPage.value),
      limit: String(projectPageSize.value),
    })
    if (search.value.trim()) params.set('q', search.value.trim())
    const result = await api<PageResult<Project>>(
      `/api/projects?${params}`,
      {},
      auth.token,
    )
    projects.value = result.items
    projectPage.value = result.page
    projectPages.value = result.pages
    projectTotal.value = result.total
    if (result.total > 0 && result.page > result.pages) {
      projectPage.value = result.pages
      await loadProjects()
    }
  } catch (e) {
    error.value = errorMessage(e, '프로젝트를 불러오지 못했어요')
  } finally {
    loadingProjects.value = false
  }
}

watch(
  () => [props.team.id, search.value, props.revision] as const,
  ([id], previous) => {
    if (previous && id !== previous[0]) teamPane.value = 'projects'
    projectPage.value = 1
    void loadProjects()
  },
  { immediate: true },
)

watch(query, (value) => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    search.value = value
  }, 250)
})

watch(memberQuery, () => {
  memberPage.value = 1
})

watch(memberPages, (count) => {
  if (memberPage.value > count) memberPage.value = count
})

watch(
  () => props.team.members,
  (members) => {
    if (!activeMember.value) return
    const next = members.find((m) => m.userId === activeMember.value?.userId)
    if (next) activeMember.value = next
    else {
      memberOpen.value = false
      activeMember.value = null
    }
  },
)

watch(projectPageSize, () => {
  window.clearTimeout(projectSizeTimer)
  projectSizeTimer = window.setTimeout(() => {
    void loadProjects()
  }, 120)
})

onUnmounted(() => {
  window.clearTimeout(searchTimer)
  window.clearTimeout(projectSizeTimer)
})

const setProjectPage = (next: number) => {
  projectPage.value = next
  void loadProjects()
}

const openInvite = () => {
  inviteError.value = ''
  inviteOpen.value = true
}

const canManageMember = (member: TeamMember) =>
  isOwner.value && member.userId !== props.team.ownerId

const openMember = (member: TeamMember) => {
  if (!canManageMember(member)) return
  memberError.value = ''
  activeMember.value = member
  memberOpen.value = true
}

const invite = async (email: string, role: string) => {
  const next = email.trim()
  if (!next) return
  error.value = ''
  inviteError.value = ''
  inviting.value = true
  try {
    const result = await api<
      | { status: 'joined' }
      | { status: 'invited'; mailed: boolean }
    >(
      `/api/teams/${props.team.id}/members`,
      {
        method: 'POST',
        body: JSON.stringify({ email: next, role }),
      },
      auth.token,
    )
    toast(
      result.status === 'joined'
        ? '팀원으로 추가했어요'
        : result.mailed
          ? '초대 메일을 보냈어요'
          : '아직 가입하지 않은 분이에요. 링크를 복사해 초대해 주세요.',
    )
    inviteOpen.value = false
    emit('changed')
  } catch (e) {
    inviteError.value = errorMessage(e, '초대하지 못했어요')
  } finally {
    inviting.value = false
  }
}

const changeRole = async (userId: string, role: string) => {
  memberError.value = ''
  memberBusy.value = true
  try {
    await api(
      `/api/teams/${props.team.id}/members/${userId}`,
      { method: 'PATCH', body: JSON.stringify({ role }) },
      auth.token,
    )
    memberOpen.value = false
    activeMember.value = null
    emit('changed')
    toast('역할을 바꿨어요')
  } catch (e) {
    memberError.value = errorMessage(e, '역할을 바꾸지 못했어요')
  } finally {
    memberBusy.value = false
  }
}

const removeMember = async (userId: string, name: string) => {
  const ok = await confirm({
    title: `${name}님을 내보낼까요?`,
    description: '이 팀 프로젝트에 더 이상 들어올 수 없어요.',
    confirmLabel: '내보내기',
    destructive: true,
  })
  if (!ok) return
  memberError.value = ''
  memberBusy.value = true
  try {
    await api(
      `/api/teams/${props.team.id}/members/${userId}`,
      { method: 'DELETE' },
      auth.token,
    )
    memberOpen.value = false
    activeMember.value = null
    emit('changed')
    toast('팀에서 내보냈어요')
  } catch (e) {
    memberError.value = errorMessage(e, '내보내지 못했어요')
  } finally {
    memberBusy.value = false
  }
}

const copyInvite = async (url: string) => {
  await navigator.clipboard.writeText(url)
  toast('초대 링크를 복사했어요')
}

const resendInvite = async (invite: PendingInvitation) => {
  error.value = ''
  try {
    const result = await api<{ mailed: boolean }>(
      `/api/teams/${props.team.id}/invitations/${invite.id}/resend`,
      { method: 'POST' },
      auth.token,
    )
    toast(result.mailed ? '초대 메일을 다시 보냈어요' : '초대 링크를 갱신했어요')
    emit('changed')
  } catch (e) {
    error.value = errorMessage(e, '다시 보내지 못했어요')
  }
}

const revokeInvite = async (invite: PendingInvitation) => {
  const ok = await confirm({
    title: '초대를 취소할까요?',
    description: `${invite.email}님에게 보낸 초대가 무효가 돼요.`,
    confirmLabel: '초대 취소',
    destructive: true,
  })
  if (!ok) return
  error.value = ''
  try {
    await api(
      `/api/teams/${props.team.id}/invitations/${invite.id}`,
      { method: 'DELETE' },
      auth.token,
    )
    emit('changed')
  } catch (e) {
    error.value = errorMessage(e, '초대를 취소하지 못했어요')
  }
}

const create = (name: string, fromSample: boolean) => {
  emit('create', fromSample, name)
}

const renameTeam = async (name: string) => {
  const next = name.trim()
  if (!next || next === props.team.name) return
  error.value = ''
  try {
    await api(
      `/api/teams/${props.team.id}`,
      { method: 'PATCH', body: JSON.stringify({ name: next }) },
      auth.token,
    )
    toast('팀 이름을 바꿨어요')
    emit('changed')
  } catch (e) {
    error.value = errorMessage(e, '이름을 바꾸지 못했어요')
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
    <div class="shrink-0 space-y-2">
      <RouterLink
        :to="{ name: 'teams' }"
        class="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft class="size-3.5" />
        팀
      </RouterLink>
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="flex min-w-0 items-center gap-1.5">
            <h1 class="truncate text-[20px] font-bold tracking-[-0.03em]">
              {{ team.name }}
            </h1>
            <button
              v-if="isOwner"
              type="button"
              class="flex size-8 shrink-0 items-center justify-center rounded-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="팀 이름 바꾸기"
              @click="renameOpen = true"
            >
              <Pencil class="size-3.5" />
            </button>
          </div>
          <p class="mt-0.5 text-[13px] text-muted-foreground">
            {{ team.members.length }}명 · {{ projectCount }}개 프로젝트
          </p>
        </div>
        <Button
          v-if="isOwner"
          variant="softDestructive"
          size="sm"
          class="shrink-0"
          @click="emit('remove-team')"
        >
          팀 삭제
        </Button>
        <Button
          v-else
          variant="secondary"
          size="sm"
          class="shrink-0"
          @click="emit('leave-team')"
        >
          팀 나가기
        </Button>
      </div>
    </div>

    <SegmentedControl
      class="h-11 w-full shrink-0 xl:hidden"
      :model-value="teamPane"
      :options="[
        { value: 'projects', label: '프로젝트' },
        { value: 'members', label: '팀원' },
      ]"
      @update:model-value="setTeamPane"
    />

    <div
      class="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(0,1fr)_20rem]"
    >
      <section
        class="flex min-h-0 flex-col gap-2 overflow-hidden"
        :class="teamPane !== 'projects' ? 'max-xl:hidden' : ''"
      >
        <div class="flex shrink-0 items-center justify-between gap-3">
          <h2 class="text-[15px] font-semibold">프로젝트</h2>
          <Button size="sm" class="min-h-11 gap-1.5 px-3" @click="createOpen = true">
            <Plus class="size-4" />
            만들기
          </Button>
        </div>
        <FieldBar class="shrink-0">
          <Search class="ml-1 size-4 shrink-0 text-muted-foreground" />
          <Input
            v-model="query"
            class="h-10 min-w-0 flex-1 bg-transparent px-0 focus-visible:bg-transparent focus-visible:ring-0"
            placeholder="프로젝트 검색"
            aria-label="프로젝트 검색"
            type="search"
          />
        </FieldBar>

        <div ref="projectViewport" class="min-h-0 flex-1 overflow-y-auto">
          <Spinner
            v-if="loadingProjects && !projects.length"
            class="rounded-2xl bg-card px-4 py-16 ring-1 ring-border shadow-[0_2px_8px_rgb(25_31_40_/_0.06)]"
            label="프로젝트를 불러오고 있어요"
          />
          <p
            v-else-if="!projects.length"
            class="rounded-2xl bg-card px-4 py-12 text-center text-[15px] text-muted-foreground ring-1 ring-border shadow-[0_2px_8px_rgb(25_31_40_/_0.06)]"
          >
            {{
              search.trim()
                ? '이 팀에서 검색과 맞는 프로젝트가 없어요.'
                : '아직 프로젝트가 없어요.'
            }}
          </p>
          <div
            v-else
            class="divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-border shadow-[0_2px_8px_rgb(25_31_40_/_0.06)]"
          >
            <div
              v-for="p in projects"
              :key="p.id"
              data-fit-row
              class="relative flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <RouterLink
                class="absolute inset-0"
                :to="`/app/${p.id}`"
                :aria-label="p.name"
              />
              <div class="relative z-[1] min-w-0 flex-1 pointer-events-none">
                <p class="truncate text-[15px] font-semibold">{{ p.name }}</p>
                <p class="mt-0.5 truncate text-[13px] text-muted-foreground">
                  {{ formatUpdated(p.updatedAt) }} 수정
                  <template v-if="p._count?.members != null">
                    · {{ p._count.members }}명
                  </template>
                  <template v-if="p.description"> · {{ p.description }}</template>
                  <template v-if="p.tags?.length">
                    ·
                    <span v-for="tag in p.tags" :key="tag" class="mr-1"
                      >#{{ tag }}</span
                    >
                  </template>
                </p>
              </div>
              <div class="relative z-[1] flex shrink-0 items-center gap-2">
                <Button
                  v-if="canDeleteProject(p, auth.user?.id, team.ownerId)"
                  variant="softDestructive"
                  size="sm"
                  class="min-h-11 min-w-16"
                  @click.stop="emit('remove-project', p.id)"
                >
                  삭제
                </Button>
                <Button
                  v-else-if="!isProjectOwner(p, auth.user?.id)"
                  variant="secondary"
                  size="sm"
                  class="min-h-11 min-w-16"
                  @click.stop="setTeamPane('members')"
                >
                  팀에서 관리
                </Button>
                <Button
                  v-else-if="canLeaveProject(p, auth.user?.id)"
                  variant="secondary"
                  size="sm"
                  class="min-h-11 min-w-16"
                  @click.stop="emit('leave-project', p.id)"
                >
                  나가기
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div class="flex min-h-9 shrink-0 items-center">
          <PaginationBar
            :page="projectPage"
            :pages="projectPages"
            :total="projectTotal"
            noun="개 프로젝트"
            @update:page="setProjectPage"
          />
        </div>
      </section>

      <section
        class="flex min-h-0 flex-col gap-2 overflow-hidden"
        :class="teamPane !== 'members' ? 'max-xl:hidden' : ''"
      >
        <div class="flex shrink-0 items-center justify-between gap-3">
          <h2 class="text-[15px] font-semibold">팀원</h2>
          <Button
            v-if="isOwner"
            size="sm"
            class="min-h-11 gap-1.5 px-3"
            @click="openInvite"
          >
            <Plus class="size-4" />
            초대
          </Button>
        </div>
        <FieldBar class="shrink-0">
          <Search class="ml-1 size-4 shrink-0 text-muted-foreground" />
          <Input
            v-model="memberQuery"
            class="h-10 min-w-0 flex-1 bg-transparent px-0 focus-visible:bg-transparent focus-visible:ring-0"
            placeholder="이름 또는 이메일"
            aria-label="팀원 검색"
            type="search"
          />
        </FieldBar>
        <div ref="memberViewport" class="min-h-0 flex-1 overflow-y-auto">
          <p
            v-if="!memberTotal"
            class="rounded-2xl bg-card px-5 py-10 text-center text-[15px] text-muted-foreground ring-1 ring-border shadow-[0_2px_8px_rgb(25_31_40_/_0.06)]"
          >
            {{
              memberQuery.trim()
                ? '검색과 맞는 팀원이 없어요.'
                : '아직 팀원이 없어요.'
            }}
          </p>
          <div
            v-else
            class="divide-y divide-border overflow-hidden rounded-2xl bg-card ring-1 ring-border shadow-[0_2px_8px_rgb(25_31_40_/_0.06)]"
          >
            <template
              v-for="row in pagedMemberRows"
              :key="row.kind === 'member' ? row.member.userId : row.invite.id"
            >
              <button
                v-if="row.kind === 'member'"
                type="button"
                data-fit-row
                class="flex w-full items-center gap-3 px-4 py-3 text-left"
                :class="
                  canManageMember(row.member)
                    ? 'transition-colors hover:bg-muted/50'
                    : 'cursor-default'
                "
                @click="openMember(row.member)"
              >
                <Avatar class="size-9 text-[13px]">
                  {{ initialOf(row.member.user.name) }}
                </Avatar>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-[15px] font-semibold">
                    {{ row.member.user.name }}
                  </p>
                  <p class="truncate text-[13px] text-muted-foreground">
                    {{ row.member.user.email }}
                  </p>
                </div>
                <Badge class="shrink-0">
                  {{
                    row.member.userId === team.ownerId
                      ? '소유자'
                      : roleLabel(row.member.role)
                  }}
                </Badge>
                <ChevronRight
                  v-if="canManageMember(row.member)"
                  class="size-4 shrink-0 text-muted-foreground"
                />
              </button>
              <div v-else data-fit-row class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <Avatar class="size-9 text-[13px]">
                    {{ row.invite.email.slice(0, 1).toUpperCase() }}
                  </Avatar>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-[15px] font-semibold">
                      {{ row.invite.email }}
                    </p>
                    <p class="text-[13px] text-muted-foreground">초대 대기</p>
                  </div>
                  <Badge
                    class="shrink-0 bg-[#fff6d8] text-[#c78500] dark:bg-[#3d3420] dark:text-[#f5c84c]"
                  >
                    {{ roleLabel(row.invite.role) }}
                  </Badge>
                </div>
                <div
                  v-if="isOwner"
                  class="mt-2 flex items-center justify-end gap-1"
                >
                  <Button
                    v-if="row.invite.inviteUrl"
                    variant="ghost"
                    size="sm"
                    @click="row.invite.inviteUrl && copyInvite(row.invite.inviteUrl)"
                  >
                    링크
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    @click="resendInvite(row.invite)"
                  >
                    재발송
                  </Button>
                  <Button
                    variant="ghostDestructive"
                    size="sm"
                    @click="revokeInvite(row.invite)"
                  >
                    취소
                  </Button>
                </div>
              </div>
            </template>
          </div>
        </div>
        <div class="flex min-h-9 shrink-0 items-center">
          <PaginationBar
            :page="memberPage"
            :pages="memberPages"
            :total="memberTotal"
            noun="명"
            @update:page="setMemberPage"
          />
        </div>
        <p v-if="error" class="shrink-0 text-sm text-destructive">{{ error }}</p>
      </section>
    </div>
    <CreateTeamDialog
      v-model:open="renameOpen"
      title="팀 이름 바꾸기"
      description="팀원에게 보이는 이름을 바꿔요"
      confirm-label="저장"
      :initial-name="team.name"
      @create="renameTeam"
    />
    <CreateProjectDialog
      v-model:open="createOpen"
      :team-name="team.name"
      @create="create"
    />
    <InviteMemberDialog
      v-model:open="inviteOpen"
      :busy="inviting"
      :error="inviteError"
      :team-name="team.name"
      @invite="invite"
    />
    <ManageMemberDialog
      v-model:open="memberOpen"
      :member="activeMember"
      :busy="memberBusy"
      :error="memberError"
      @change-role="changeRole"
      @remove="removeMember"
    />
  </div>
</template>
