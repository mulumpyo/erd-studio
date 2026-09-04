<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ChevronRight, Plus, Search } from 'lucide-vue-next'
import { api, ApiError } from '@/api'
import { errorMessage, initialOf } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import {
  canDeleteProject,
  canLeaveProject,
  type PageResult,
  type Project,
  type Team,
} from '@/types/workspace'
import CreateProjectDialog from '@/components/dashboard/CreateProjectDialog.vue'
import CreateTeamDialog from '@/components/dashboard/CreateTeamDialog.vue'
import TeamPickDialog from '@/components/dashboard/TeamPickDialog.vue'
import TeamWorkspace from '@/components/dashboard/TeamWorkspace.vue'
import WorkspaceSidebar, {
  type WorkspaceTab,
} from '@/components/dashboard/WorkspaceSidebar.vue'
import AppShell from '@/components/layout/AppShell.vue'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import Button from '@/components/ui/button/Button.vue'
import FieldBar from '@/components/ui/field-bar/FieldBar.vue'
import Input from '@/components/ui/input/Input.vue'
import PaginationBar from '@/components/ui/pagination/PaginationBar.vue'
import { confirm, notice } from '@/composables/useConfirm'
import { useFitPageSize } from '@/composables/usePageSize'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const teams = ref<Team[]>([])
const projects = ref<Project[]>([])
const selectedTeam = ref<Team | null>(null)
const createTeam = ref<Team | null>(null)
const query = ref('')
const search = ref('')
const page = ref(1)
const pages = ref(1)
const total = ref(0)
const hasTeams = ref(false)
const revision = ref(0)
const error = ref('')
const loading = ref(false)
const teamPickOpen = ref(false)
const projectDialogOpen = ref(false)
const teamDialogOpen = ref(false)
const listViewport = ref<HTMLElement | null>(null)
let searchTimer = 0
let sizeTimer = 0

const tab = computed<WorkspaceTab>(() =>
  route.name === 'dashboard' ? 'projects' : 'teams',
)
const teamId = computed(() => {
  const id = route.params.teamId
  return typeof id === 'string' ? id : null
})
const heading = computed(() => {
  if (tab.value === 'projects') return '프로젝트'
  return selectedTeam.value?.name ?? '팀'
})
const crumbKicker = computed(() => (teamId.value ? '팀' : '워크스페이스'))
const crumbTo = computed(() =>
  teamId.value ? { name: 'teams' as const } : undefined,
)
const pageSize = useFitPageSize(
  listViewport,
  () => (tab.value === 'teams' ? 76 : 88),
  [tab],
)
const formatUpdated = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { dateStyle: 'medium' })

const setTab = (next: WorkspaceTab) => {
  if (next === 'projects') router.push({ name: 'dashboard' })
  else router.push({ name: 'teams' })
}

const loadHasTeams = async () => {
  const result = await api<PageResult<Team>>(
    '/api/teams?limit=1',
    {},
    auth.token,
  )
  hasTeams.value = result.total > 0
}

const loadProjects = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: String(pageSize.value),
    })
    if (search.value.trim()) params.set('q', search.value.trim())
    const result = await api<PageResult<Project>>(
      `/api/projects?${params}`,
      {},
      auth.token,
    )
    projects.value = result.items
    page.value = result.page
    pages.value = result.pages
    total.value = result.total
    if (result.total > 0 && result.page > result.pages) {
      page.value = result.pages
      await loadProjects()
      return
    }
    await loadHasTeams()
  } catch (e) {
    error.value = errorMessage(e, '프로젝트를 불러오지 못했어요')
  } finally {
    loading.value = false
  }
}

const loadTeams = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: String(pageSize.value),
    })
    if (search.value.trim()) params.set('q', search.value.trim())
    const result = await api<PageResult<Team>>(
      `/api/teams?${params}`,
      {},
      auth.token,
    )
    teams.value = result.items
    page.value = result.page
    pages.value = result.pages
    total.value = result.total
    if (result.total > 0 && result.page > result.pages) {
      page.value = result.pages
      await loadTeams()
    }
  } catch (e) {
    error.value = errorMessage(e, '팀을 불러오지 못했어요')
  } finally {
    loading.value = false
  }
}

const loadTeam = async (id: string) => {
  loading.value = true
  error.value = ''
  try {
    selectedTeam.value = await api<Team>(`/api/teams/${id}`, {}, auth.token)
    revision.value += 1
  } catch (e) {
    error.value = errorMessage(e, '팀을 불러오지 못했어요')
    if (e instanceof ApiError && e.status === 404) {
      await router.replace({ name: 'teams' })
    }
  } finally {
    loading.value = false
  }
}

const load = async () => {
  if (teamId.value) {
    await loadTeam(teamId.value)
    return
  }
  selectedTeam.value = null
  if (tab.value === 'projects') await loadProjects()
  else await loadTeams()
}

const setPage = (next: number) => {
  page.value = next
  void load()
}

const startCreateProject = () => {
  teamPickOpen.value = true
}

const onPickTeam = async (team: Team) => {
  createTeam.value = team
  await nextTick()
  projectDialogOpen.value = true
}

const createProject = async (name: string, fromSample: boolean, teamId?: string) => {
  const id = teamId || createTeam.value?.id
  if (!id) {
    error.value = '먼저 팀을 만들어 주세요'
    return
  }
  error.value = ''
  try {
    const project = await api<Project>(
      '/api/projects',
      {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim() || '새 다이어그램',
          teamId: id,
          fromSample,
        }),
      },
      auth.token,
    )
    router.push(`/app/${project.id}`)
  } catch (e) {
    error.value = errorMessage(e, '프로젝트를 만들지 못했어요')
  }
}

const createInTeam = (team: Team, fromSample: boolean, name: string) => {
  void createProject(name, fromSample, team.id)
}

const submitTeam = async (name: string) => {
  error.value = ''
  try {
    const team = await api<Team>(
      '/api/teams',
      { method: 'POST', body: JSON.stringify({ name }) },
      auth.token,
    )
    await router.push({ name: 'team', params: { teamId: team.id } })
  } catch (e) {
    error.value = errorMessage(e, '팀을 만들지 못했어요')
  }
}

const leaveTeam = async (id: string) => {
  const ok = await confirm({
    title: '이 팀에서 나갈까요?',
    description: '이 팀의 프로젝트에 더 이상 들어올 수 없어요.',
    confirmLabel: '나가기',
  })
  if (!ok) return
  error.value = ''
  try {
    await api(`/api/teams/${id}/leave`, { method: 'DELETE' }, auth.token)
    await router.push({ name: 'teams' })
  } catch (e) {
    error.value = errorMessage(e, '나가지 못했어요')
  }
}

const leaveProject = async (id: string) => {
  const ok = await confirm({
    title: '이 프로젝트에서 나갈까요?',
    description: '더 이상 이 다이어그램을 보거나 편집하지 못해요.',
    confirmLabel: '나가기',
  })
  if (!ok) return
  error.value = ''
  try {
    await api(`/api/projects/${id}/leave`, { method: 'DELETE' }, auth.token)
    await load()
  } catch (e) {
    error.value = errorMessage(e, '나가지 못했어요')
  }
}

const removeProject = async (id: string) => {
  const ok = await confirm({
    title: '프로젝트를 삭제할까요?',
    description: '다이어그램이 사라져요. 되돌릴 수 없어요.',
    confirmLabel: '삭제하기',
    destructive: true,
  })
  if (!ok) return
  error.value = ''
  try {
    await api(`/api/projects/${id}`, { method: 'DELETE' }, auth.token)
    await load()
  } catch (e) {
    error.value = errorMessage(e, '삭제하지 못했어요')
  }
}

const removeTeam = async (team: Team) => {
  error.value = ''
  const projectCount = team._count?.projects ?? 0
  if (projectCount > 0) {
    await notice({
      title: '프로젝트가 남아 있어요',
      description: `${team.name} 팀에 프로젝트가 ${projectCount}개 있어요. 프로젝트를 모두 삭제한 뒤에 팀을 삭제할 수 있어요.`,
      confirmLabel: '알겠어요',
    })
    return
  }
  const ok = await confirm({
    title: '팀을 삭제할까요?',
    description: '팀과 멤버 구성이 사라져요. 되돌릴 수 없어요.',
    matchValue: team.name,
    matchHint: '팀 이름을 똑같이 입력해 주세요',
    confirmLabel: '삭제하기',
    destructive: true,
  })
  if (!ok) return
  try {
    await api(`/api/teams/${team.id}`, { method: 'DELETE' }, auth.token)
    await router.push({ name: 'teams' })
  } catch (e) {
    if (e instanceof ApiError && e.status === 400) {
      await notice({
        title: '팀을 삭제할 수 없어요',
        description: e.message,
        confirmLabel: '알겠어요',
      })
      await load()
      return
    }
    error.value = errorMessage(e, '삭제하지 못했어요')
  }
}

const signOut = async () => {
  await auth.logout()
  router.push('/')
}

watch(query, (value) => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    search.value = value
    page.value = 1
    void load()
  }, 250)
})

watch(pageSize, () => {
  if (teamId.value) return
  window.clearTimeout(sizeTimer)
  sizeTimer = window.setTimeout(() => {
    void load()
  }, 120)
})

onMounted(load)
onUnmounted(() => {
  window.clearTimeout(searchTimer)
  window.clearTimeout(sizeTimer)
})
</script>

<template>
  <AppShell
    :kicker="crumbKicker"
    :title="heading"
    :kicker-to="crumbTo"
  >
    <template #sidebar>
      <WorkspaceSidebar
        :tab="tab"
        :name="auth.user?.name ?? ''"
        :email="auth.user?.email ?? ''"
        :is-admin="Boolean(auth.user?.isAdmin)"
        @update:tab="setTab"
        @admin="router.push('/admin')"
        @change-password="router.push('/account')"
        @logout="signOut"
      />
    </template>

    <main
      class="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 overflow-hidden p-3 md:p-4"
    >
      <p v-if="error" class="shrink-0 text-sm text-destructive">{{ error }}</p>

      <section
        v-if="tab === 'projects'"
        class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
      >
        <div
          class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h1 class="text-[20px] font-bold tracking-[-0.03em]">프로젝트</h1>
            <p class="mt-0.5 text-[13px] text-muted-foreground">
              속한 팀의 다이어그램을 한곳에서 봐요
            </p>
          </div>
          <Button class="h-11 shrink-0 gap-1.5 px-4" @click="startCreateProject">
            <Plus class="size-4" />
            만들기
          </Button>
        </div>
        <FieldBar class="max-w-md shrink-0">
          <Search class="ml-1 size-4 shrink-0 text-muted-foreground" />
          <Input
            v-model="query"
            class="h-10 min-w-0 flex-1 bg-transparent px-0 focus-visible:bg-transparent focus-visible:ring-0"
            placeholder="프로젝트 검색"
            aria-label="프로젝트 검색"
            type="search"
          />
        </FieldBar>
        <div ref="listViewport" class="min-h-0 flex-1 overflow-y-auto">
          <p
            v-if="!loading && !hasTeams && !projects.length"
            class="rounded-2xl bg-card px-4 py-12 text-center text-[15px] text-muted-foreground"
          >
            팀을 먼저 만들면 프로젝트를 시작할 수 있어요.
            <button
              type="button"
              class="mt-3 block w-full font-semibold text-primary"
              @click="startCreateProject"
            >
              팀 만들고 시작하기
            </button>
          </p>
          <p
            v-else-if="loading && !projects.length"
            class="rounded-2xl bg-card px-4 py-12 text-center text-[15px] text-muted-foreground"
          >
            프로젝트를 불러오는 중이에요.
          </p>
          <p
            v-else-if="!projects.length"
            class="rounded-2xl bg-card px-4 py-12 text-center text-[15px] text-muted-foreground"
          >
            {{
              search.trim()
                ? '검색과 맞는 프로젝트가 없어요.'
                : '아직 프로젝트가 없어요.'
            }}
          </p>
          <div
            v-else
            class="divide-y divide-border overflow-hidden rounded-2xl bg-card"
          >
            <div
              v-for="project in projects"
              :key="project.id"
              data-fit-row
              class="relative flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <RouterLink
                class="absolute inset-0"
                :to="`/app/${project.id}`"
                :aria-label="project.name"
              />
              <div class="relative z-[1] min-w-0 flex-1 pointer-events-none">
                <p class="flex min-w-0 items-center gap-1 text-[15px]">
                  <RouterLink
                    v-if="project.team"
                    class="pointer-events-auto truncate text-muted-foreground hover:underline"
                    :to="{ name: 'team', params: { teamId: project.team.id } }"
                  >
                    {{ project.team.name }}
                  </RouterLink>
                  <span v-else class="truncate text-muted-foreground">팀</span>
                  <ChevronRight
                    class="size-3.5 shrink-0 text-muted-foreground"
                  />
                  <span class="truncate font-semibold">{{ project.name }}</span>
                </p>
                <p class="mt-0.5 truncate text-[13px] text-muted-foreground">
                  {{ formatUpdated(project.updatedAt) }} 수정
                  <template v-if="project.description">
                    · {{ project.description }}
                  </template>
                  <template v-if="project.tags?.length">
                    ·
                    <span
                      v-for="tag in project.tags"
                      :key="tag"
                      class="mr-1"
                    >#{{ tag }}</span>
                  </template>
                </p>
              </div>
              <div
                class="relative z-[1] flex shrink-0 items-center gap-2"
              >
                <Button
                  v-if="canDeleteProject(project, auth.user?.id)"
                  variant="softDestructive"
                  size="sm"
                  class="min-h-11 min-w-16"
                  @click.stop="removeProject(project.id)"
                >
                  삭제
                </Button>
                <Button
                  v-else-if="canLeaveProject(project, auth.user?.id)"
                  variant="secondary"
                  size="sm"
                  class="min-h-11 min-w-16"
                  @click.stop="leaveProject(project.id)"
                >
                  나가기
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div class="flex min-h-9 shrink-0 items-center">
          <PaginationBar
            :page="page"
            :pages="pages"
            :total="total"
            noun="개 프로젝트"
            @update:page="setPage"
          />
        </div>
      </section>

      <section
        v-else-if="!teamId"
        class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
      >
        <div
          class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h1 class="text-[20px] font-bold tracking-[-0.03em]">팀</h1>
            <p class="mt-0.5 text-[13px] text-muted-foreground">
              같이 그리는 사람과 프로젝트를 팀으로 묶어요
            </p>
          </div>
          <Button class="h-11 shrink-0 gap-1.5 px-4" @click="teamDialogOpen = true">
            <Plus class="size-4" />
            만들기
          </Button>
        </div>
        <FieldBar class="max-w-md shrink-0">
          <Search class="ml-1 size-4 shrink-0 text-muted-foreground" />
          <Input
            v-model="query"
            class="h-10 min-w-0 flex-1 bg-transparent px-0 focus-visible:bg-transparent focus-visible:ring-0"
            placeholder="팀 검색"
            aria-label="팀 검색"
            type="search"
          />
        </FieldBar>
        <div ref="listViewport" class="min-h-0 flex-1 overflow-y-auto">
          <p
            v-if="loading && !teams.length"
            class="rounded-2xl bg-card px-4 py-12 text-center text-[15px] text-muted-foreground"
          >
            팀을 불러오는 중이에요.
          </p>
          <p
            v-else-if="!teams.length"
            class="rounded-2xl bg-card px-4 py-12 text-center text-[15px] text-muted-foreground"
          >
            {{
              search.trim()
                ? '검색과 맞는 팀이 없어요.'
                : '팀을 만들면 멤버와 프로젝트를 한곳에서 볼 수 있어요.'
            }}
          </p>
          <div
            v-else
            class="divide-y divide-border overflow-hidden rounded-2xl bg-card"
          >
            <button
              v-for="team in teams"
              :key="team.id"
              type="button"
              data-fit-row
              class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              @click="router.push({ name: 'team', params: { teamId: team.id } })"
            >
              <div class="flex min-w-0 items-center gap-3">
                <Avatar class="size-9 bg-primary/10 text-[13px] text-primary">
                  {{ initialOf(team.name) }}
                </Avatar>
                <div class="min-w-0">
                  <p class="truncate text-[15px] font-semibold">{{ team.name }}</p>
                  <p class="mt-0.5 text-[13px] text-muted-foreground">
                    {{ team.members.length }}명 ·
                    {{ team._count?.projects ?? 0 }}개 프로젝트
                  </p>
                </div>
              </div>
              <ChevronRight class="size-4 shrink-0 text-muted-foreground" />
            </button>
          </div>
        </div>
        <div class="flex min-h-9 shrink-0 items-center">
          <PaginationBar
            :page="page"
            :pages="pages"
            :total="total"
            noun="개 팀"
            @update:page="setPage"
          />
        </div>
      </section>

      <p
        v-else-if="loading && !selectedTeam"
        class="rounded-2xl bg-card px-4 py-12 text-center text-[15px] text-muted-foreground"
      >
        팀을 불러오는 중이에요.
      </p>
      <TeamWorkspace
        v-else-if="selectedTeam"
        :key="selectedTeam.id"
        class="min-h-0 flex-1 overflow-hidden"
        :team="selectedTeam"
        :revision="revision"
        @changed="() => teamId && loadTeam(teamId)"
        @create="
          (fromSample, name) => createInTeam(selectedTeam, fromSample, name)
        "
        @remove-team="removeTeam(selectedTeam)"
        @leave-team="leaveTeam(selectedTeam.id)"
        @remove-project="removeProject"
        @leave-project="leaveProject"
      />
    </main>
    <TeamPickDialog v-model:open="teamPickOpen" @select="onPickTeam" />
    <CreateProjectDialog
      v-model:open="projectDialogOpen"
      :team-name="createTeam?.name"
      @create="(name, fromSample) => createProject(name, fromSample)"
    />
    <CreateTeamDialog v-model:open="teamDialogOpen" @create="submitTeam" />
  </AppShell>
</template>
