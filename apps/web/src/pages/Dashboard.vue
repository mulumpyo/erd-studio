<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from 'lucide-vue-next'
import { api, ApiError } from '@/api'
import { errorMessage } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import {
  type PageResult,
  type Project,
  type Team,
} from '@/types/workspace'
import TeamWorkspace from '@/components/dashboard/TeamWorkspace.vue'
import AccountMenu from '@/components/dashboard/AccountMenu.vue'
import Button from '@/components/ui/button/Button.vue'
import ThemeToggle from '@/components/ThemeToggle.vue'
import FieldBar from '@/components/ui/field-bar/FieldBar.vue'
import Input from '@/components/ui/input/Input.vue'
import PaginationBar from '@/components/ui/pagination/PaginationBar.vue'
import { confirm, notice } from '@/composables/useConfirm'
import { usePageSize } from '@/composables/usePageSize'

const auth = useAuthStore()
const router = useRouter()
const teams = ref<Team[]>([])
const teamName = ref('')
const query = ref('')
const search = ref('')
const teamPage = ref(1)
const teamPages = ref(1)
const teamTotal = ref(0)
const revision = ref(0)
const error = ref('')
const loading = ref(false)
const pageSize = usePageSize()
let searchTimer = 0

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      page: String(teamPage.value),
      limit: String(pageSize.value),
    })
    if (search.value.trim()) params.set('q', search.value.trim())
    const result = await api<PageResult<Team>>(
      `/api/teams?${params}`,
      {},
      auth.token,
    )
    teams.value = result.items
    teamPages.value = result.pages
    teamTotal.value = result.total
    revision.value += 1
  } catch (e) {
    error.value = errorMessage(e, '팀을 불러오지 못했어요')
  } finally {
    loading.value = false
  }
}

const setTeamPage = (next: number) => {
  teamPage.value = next
  void load()
}

const createInTeam = (team: Team, fromSample: boolean, projectName: string) =>
  createProject({
    teamId: team.id,
    fromSample,
    name: projectName,
  })

const createProject = async (opts: {
  teamId: string
  fromSample?: boolean
  name?: string
}) => {
  error.value = ''
  try {
    const project = await api<Project>(
      '/api/projects',
      {
        method: 'POST',
        body: JSON.stringify({
          name: opts.name || '새 다이어그램',
          teamId: opts.teamId,
          fromSample: opts.fromSample ?? false,
        }),
      },
      auth.token,
    )
    router.push(`/app/${project.id}`)
  } catch (e) {
    error.value = errorMessage(e, '프로젝트를 만들지 못했어요')
  }
}

const createTeam = async () => {
  if (!teamName.value.trim()) return
  error.value = ''
  try {
    await api(
      '/api/teams',
      { method: 'POST', body: JSON.stringify({ name: teamName.value }) },
      auth.token,
    )
    teamName.value = ''
    teamPage.value = 1
    await load()
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
    await load()
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
    teams.value = teams.value.filter((item) => item.id !== team.id)
    teamPage.value = teams.value.length ? teamPage.value : 1
    await load()
  } catch (e) {
    // 화면의 프로젝트 개수가 오래되어 서버가 막은 경우도 같은 모달로 알립니다.
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

// 페이지 크기가 바뀌어도 보고 있던 팀이 그대로 보이도록 페이지를 맞춥니다.
watch(pageSize, (next, prev) => {
  const firstIndex = (teamPage.value - 1) * prev
  teamPage.value = Math.floor(firstIndex / next) + 1
  void load()
})

watch(query, (value) => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    search.value = value
    teamPage.value = 1
    void load()
  }, 250)
})

onMounted(load)
onUnmounted(() => window.clearTimeout(searchTimer))
</script>

<template>
  <div class="min-h-full bg-background">
    <header
      class="flex h-16 items-center justify-between border-b border-border/80 bg-card px-6"
    >
      <div class="flex items-center gap-2.5">
        <div
          class="flex size-8 items-center justify-center rounded-2xl bg-primary text-[13px] font-bold text-white"
        >
          E
        </div>
        <div class="text-[17px] font-bold tracking-[-0.03em]">ERD Studio</div>
      </div>
      <div class="flex items-center gap-2">
        <ThemeToggle />
        <AccountMenu
          :name="auth.user?.name ?? ''"
          :email="auth.user?.email ?? ''"
          @change-password="router.push('/account')"
          @logout="signOut"
        />
      </div>
    </header>
    <main class="mx-auto max-w-6xl space-y-12 p-8">
      <section>
        <p class="text-[15px] font-semibold text-primary">워크스페이스</p>
        <h1 class="mt-1 text-[32px] font-bold leading-tight">
          {{ auth.user?.name }}님,<br class="sm:hidden" />
          안녕하세요
        </h1>
        <FieldBar class="mt-6 max-w-xl">
          <Search class="ml-1 size-4 shrink-0 text-muted-foreground" />
          <Input
            v-model="query"
            class="h-10 min-w-0 flex-1 bg-transparent px-0 focus-visible:bg-transparent focus-visible:ring-0"
            placeholder="팀 또는 프로젝트 검색"
            aria-label="팀 또는 프로젝트 검색"
          />
        </FieldBar>
      </section>
      <section class="space-y-4">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <h2 class="text-[20px] font-bold">팀</h2>
          <form @submit.prevent="createTeam">
            <FieldBar class="min-w-[280px]">
              <Input
                v-model="teamName"
                class="h-10 min-w-0 flex-1 bg-transparent px-0 focus-visible:bg-transparent focus-visible:ring-0"
                placeholder="새 팀 이름"
                aria-label="새 팀 이름"
              />
              <Button type="submit" class="h-10 shrink-0 px-4">팀 만들기</Button>
            </FieldBar>
          </form>
        </div>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <p
          v-if="loading && !teams.length"
          class="rounded-[20px] bg-card px-4 py-12 text-center text-[15px] text-muted-foreground"
        >
          팀을 불러오는 중이에요.
        </p>
        <p
          v-else-if="!teams.length"
          class="rounded-[20px] bg-card px-4 py-12 text-center text-[15px] text-muted-foreground"
        >
          {{
            search.trim()
              ? '검색과 맞는 팀이나 프로젝트가 없어요.'
              : '팀을 만들면 프로젝트와 멤버를 한곳에서 관리할 수 있어요.'
          }}
        </p>
        <TeamWorkspace
          v-for="t in teams"
          :key="t.id"
          :team="t"
          :query="search"
          :revision="revision"
          @changed="load"
          @create="
            (fromSample, projectName) =>
              createInTeam(t, fromSample, projectName)
          "
          @remove-team="removeTeam(t)"
          @leave-team="leaveTeam(t.id)"
          @remove-project="removeProject"
          @leave-project="leaveProject"
        />
        <PaginationBar
          :page="teamPage"
          :pages="teamPages"
          :total="teamTotal"
          noun="개 팀"
          @update:page="setTeamPage"
        />
      </section>
    </main>
  </div>
</template>
