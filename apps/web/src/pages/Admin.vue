<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search } from 'lucide-vue-next'
import { api, ApiError } from '@/api'
import { errorMessage } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import type { PageResult } from '@/types/workspace'
import AdminSidebar, {
  type AdminTab,
} from '@/components/admin/AdminSidebar.vue'
import AppShell from '@/components/layout/AppShell.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import FieldBar from '@/components/ui/field-bar/FieldBar.vue'
import Input from '@/components/ui/input/Input.vue'
import PaginationBar from '@/components/ui/pagination/PaginationBar.vue'
import { confirm, notice } from '@/composables/useConfirm'
import Spinner from '@/components/ui/spinner/Spinner.vue'
import { useFitPageSize } from '@/composables/usePageSize'
import { toast } from '@/composables/useToast'

type UsagePoint = { day: string; dau: number; wau: number; mau: number; withdrawn: number }

type Overview = {
  day: string
  users: {
    total: number
    signedUpToday: number
    verifiedToday: number
    withdrawnToday: number
    withdrawnTotal: number
  }
  usage: { dau: number; wau: number; mau: number }
  points: UsagePoint[]
}

type AdminUser = {
  id: string
  email: string
  name: string
  isAdmin: boolean
  locked?: boolean
  emailVerifiedAt: string | null
  suspendedAt: string | null
  createdAt: string
}

const titles: Record<AdminTab, { kicker: string; title: string }> = {
  usage: { kicker: '관리자', title: '사용량' },
  users: { kicker: '관리자', title: '사용자 관리' },
  admins: { kicker: '관리자', title: '관리자' },
}

const auth = useAuthStore()
const router = useRouter()
const tab = ref<AdminTab>('usage')
const overview = ref<Overview | null>(null)
const users = ref<AdminUser[]>([])
const userPage = ref(1)
const userPages = ref(1)
const userTotal = ref(0)
const query = ref('')
const search = ref('')
const adminEmail = ref('')
const error = ref('')
const loading = ref(false)
const listViewport = ref<HTMLElement | null>(null)
let searchTimer = 0
let sizeTimer = 0

const pageSize = useFitPageSize(
  listViewport,
  () => {
    const wide = window.matchMedia('(min-width: 768px)').matches
    if (tab.value === 'admins') return wide ? 76 : 100
    return wide ? 88 : 148
  },
  [tab],
)

const heading = computed(() => titles[tab.value])
const maxDau = computed(() =>
  Math.max(1, ...(overview.value?.points.map((p) => p.dau) ?? [1])),
)
const maxWau = computed(() =>
  Math.max(1, ...(overview.value?.points.map((p) => p.wau) ?? [1])),
)
const recentDays = computed(() =>
  [...(overview.value?.points.slice(-7) ?? [])].reverse(),
)
const usageMetrics = computed(() => {
  const stats = overview.value?.users
  const usage = overview.value?.usage
  return [
    { label: 'DAU', value: usage?.dau, hint: '오늘 쓴 사람', tone: 'activity' },
    { label: 'WAU', value: usage?.wau, hint: '최근 7일', tone: 'activity' },
    { label: 'MAU', value: usage?.mau, hint: '최근 30일', tone: 'activity' },
    { label: '총 가입자', value: stats?.total, hint: '탈퇴하지 않은 계정', tone: 'signup' },
    { label: '오늘 가입', value: stats?.signedUpToday, hint: '오늘 만든 계정', tone: 'signup' },
    { label: '오늘 인증', value: stats?.verifiedToday, hint: '오늘 이메일 인증', tone: 'signup' },
    { label: '오늘 탈퇴', value: stats?.withdrawnToday, hint: '오늘 지운 계정', tone: 'leave' },
    { label: '누적 탈퇴', value: stats?.withdrawnTotal, hint: '지금까지 탈퇴', tone: 'leave' },
  ] as const
})
const metricTone: Record<(typeof usageMetrics.value)[number]['tone'], string> = {
  signup: 'bg-[#e8f8f0] text-[#03b26c] dark:bg-[#1a3d32] dark:text-[#3dd68c]',
  leave: 'bg-[#fff1f1] text-[#d63a48] dark:bg-[#3a1d22] dark:text-[#f08890]',
  activity: 'bg-[#e8f3ff] text-[#1b64da] dark:bg-[#1a2d4a] dark:text-[#7eb6ff]',
}
const peakDau = computed(() => {
  const points = overview.value?.points ?? []
  if (!points.length) return null
  return points.reduce((best, point) =>
    point.dau > best.dau ? point : best,
  )
})

const formatOverviewDay = (day: string) => {
  const [year, month, date] = day.split('-')
  if (!year || !month || !date) return day
  return `${year}년 ${Number(month)}월 ${Number(date)}일`
}

const signOut = async () => {
  await auth.logout()
  router.push('/')
}

const setTab = (next: AdminTab) => {
  tab.value = next
}

const loadOverview = async () => {
  overview.value = await api<Overview>('/api/admin/overview', {}, auth.token)
}

const loadUsers = async (adminsOnly = false) => {
  const params = new URLSearchParams({
    page: String(userPage.value),
    limit: String(pageSize.value),
  })
  if (search.value.trim()) params.set('q', search.value.trim())
  if (adminsOnly) params.set('adminsOnly', 'true')
  const result = await api<PageResult<AdminUser>>(
    `/api/admin/users?${params}`,
    {},
    auth.token,
  )
  users.value = result.items
  userPage.value = result.page
  userPages.value = result.pages
  userTotal.value = result.total
  if (result.total > 0 && result.page > result.pages) {
    userPage.value = result.pages
    await loadUsers(adminsOnly)
  }
}

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    if (tab.value === 'usage') await loadOverview()
    else await loadUsers(tab.value === 'admins')
  } catch (e) {
    error.value = errorMessage(e, '불러오지 못했어요')
    if (e instanceof ApiError && e.status === 404) router.replace('/app')
  } finally {
    loading.value = false
  }
}

const addAdmin = async () => {
  error.value = ''
  try {
    await api(
      '/api/admin/admins',
      {
        method: 'POST',
        body: JSON.stringify({ email: adminEmail.value.trim() }),
      },
      auth.token,
    )
    adminEmail.value = ''
    await load()
  } catch (e) {
    error.value = errorMessage(e, '관리자로 올리지 못했어요')
  }
}

const setAdmin = async (row: AdminUser, isAdmin: boolean) => {
  if (!isAdmin) {
    const ok = await confirm({
      title: '관리자를 내릴까요?',
      description: `${row.name} (${row.email}) 계정의 관리자 권한을 없애요.`,
      confirmLabel: '내리기',
    })
    if (!ok) return
  }
  error.value = ''
  try {
    await api(
      `/api/admin/users/${row.id}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isAdmin }),
      },
      auth.token,
    )
    if (!isAdmin && row.id === auth.user?.id) {
      await auth.fetchMe()
      router.replace('/app')
      return
    }
    await load()
  } catch (e) {
    error.value = errorMessage(e, '바꾸지 못했어요')
  }
}

const sendPasswordReset = async (row: AdminUser) => {
  const ok = await confirm({
    title: '비밀번호 재설정 메일을 보낼까요?',
    description: `${row.email}로 재설정 링크를 보내요.`,
    confirmLabel: '보내기',
  })
  if (!ok) return
  error.value = ''
  try {
    const result = await api<{ mailed: boolean; resetUrl?: string }>(
      `/api/admin/users/${row.id}/password-reset`,
      { method: 'POST' },
      auth.token,
    )
    if (result.resetUrl) {
      await notice({
        title: '메일을 보내지 못했어요',
        description: `로컬에서는 이 링크로 바꿀 수 있어요.\n${result.resetUrl}`,
        confirmLabel: '알겠어요',
      })
      return
    }
    toast(result.mailed ? '메일을 보냈어요' : '메일 설정이 없어 보내지 못했어요')
  } catch (e) {
    error.value = errorMessage(e, '메일을 보내지 못했어요')
  }
}

const setSuspended = async (row: AdminUser, suspended: boolean) => {
  const ok = await confirm({
    title: suspended ? '이 계정을 정지할까요?' : '정지를 해제할까요?',
    description: suspended
      ? `${row.name} (${row.email}) 계정은 로그인과 편집을 할 수 없어요.`
      : `${row.name} (${row.email}) 계정을 다시 쓸 수 있게 해요.`,
    confirmLabel: suspended ? '정지하기' : '해제하기',
    destructive: suspended,
  })
  if (!ok) return
  error.value = ''
  try {
    await api(
      `/api/admin/users/${row.id}/suspension`,
      {
        method: 'PATCH',
        body: JSON.stringify({ suspended }),
      },
      auth.token,
    )
    await load()
    toast(suspended ? '계정을 정지했어요' : '정지를 해제했어요')
  } catch (e) {
    error.value = errorMessage(e, '바꾸지 못했어요')
  }
}

const formatDay = (day: string) => {
  const [, month, date] = day.split('-')
  if (!month || !date) return ''
  return `${Number(month)}.${Number(date)}`
}

const formatTableDay = (day: string) => {
  const [, month, date] = day.split('-')
  if (!month || !date) return day
  return `${Number(month)}월 ${Number(date)}일`
}

const formatJoined = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { dateStyle: 'medium' })

watch(tab, () => {
  userPage.value = 1
  void load()
})

watch(query, (value) => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    search.value = value
    userPage.value = 1
    void load()
  }, 250)
})

watch(pageSize, () => {
  if (tab.value === 'usage') return
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
  <AppShell :kicker="heading.kicker" :title="heading.title">
    <template #sidebar>
      <AdminSidebar
        :tab="tab"
        :name="auth.user?.name ?? ''"
        :email="auth.user?.email ?? ''"
        @update:tab="setTab"
        @back="router.push('/app')"
        @change-password="router.push('/account')"
        @logout="signOut"
      />
    </template>

    <main
      class="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 px-4 py-3 md:p-4"
      :class="tab === 'usage' ? 'overflow-y-auto' : 'overflow-hidden'"
    >
      <p v-if="error" class="shrink-0 text-sm text-destructive">{{ error }}</p>

      <section
        v-if="tab === 'usage'"
        class="flex min-h-0 flex-col gap-3 pb-10 md:pb-2"
      >
        <Spinner
          v-if="loading && !overview"
          class="rounded-2xl bg-card px-4 py-16"
        />
        <template v-else>
          <div class="flex shrink-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h1 class="text-[18px] font-bold tracking-[-0.03em] md:text-[20px]">
              오늘 운영 현황
            </h1>
            <p class="text-[12px] text-muted-foreground md:text-[13px]">
              {{ formatOverviewDay(overview?.day ?? '') }}
              · 한국 시간 · 관리자 활동은 빼요
            </p>
          </div>

          <div class="grid shrink-0 grid-cols-3 gap-2">
            <div
              v-for="metric in usageMetrics"
              :key="metric.label"
              class="rounded-2xl px-2 py-2 sm:px-3 sm:py-2"
              :class="metricTone[metric.tone]"
              :title="metric.hint"
            >
              <p class="truncate text-[11px] opacity-75 sm:text-[12px]">
                {{ metric.label }}
              </p>
              <p class="mt-0.5 text-[18px] font-bold tabular-nums sm:text-[22px]">
                {{ metric.value ?? '—' }}
              </p>
            </div>
          </div>

          <div
            class="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(16rem,22rem)]"
          >
            <div class="flex flex-col rounded-2xl bg-card p-3 sm:p-4">
              <div class="flex shrink-0 items-baseline justify-between gap-2">
                <p class="text-[14px] font-semibold">최근 30일 DAU</p>
                <p class="truncate text-[12px] text-muted-foreground">
                  최고
                  {{
                    peakDau
                      ? `${formatDay(peakDau.day)} · ${peakDau.dau}명`
                      : '—'
                  }}
                </p>
              </div>
              <div class="mt-3 flex h-32 items-end gap-px sm:h-36">
                <div
                  v-for="point in overview?.points ?? []"
                  :key="point.day"
                  class="flex min-w-0 flex-1 flex-col items-center justify-end"
                >
                  <div
                    class="w-full max-w-3 rounded-t bg-primary/80"
                    :style="{
                      height: `${Math.max((point.dau / maxDau) * 100, point.dau ? 4 : 0)}%`,
                    }"
                    :title="`${point.day} · ${point.dau}`"
                  />
                </div>
              </div>
              <div
                class="mt-1.5 flex shrink-0 justify-between text-[11px] text-muted-foreground"
              >
                <span>{{ formatDay(overview?.points[0]?.day ?? '') }}</span>
                <span>{{ formatDay(overview?.points.at(-1)?.day ?? '') }}</span>
              </div>
            </div>

            <div class="flex flex-col rounded-2xl bg-card p-3 sm:p-4">
              <div class="flex shrink-0 items-baseline justify-between gap-2">
                <p class="text-[14px] font-semibold">최근 30일 WAU</p>
                <p class="truncate text-[12px] text-muted-foreground">
                  주간으로 얼마나 꾸준한지 봐요
                </p>
              </div>
              <div class="mt-3 flex h-32 items-end gap-px sm:h-36">
                <div
                  v-for="point in overview?.points ?? []"
                  :key="`wau-${point.day}`"
                  class="flex min-w-0 flex-1 flex-col items-center justify-end"
                >
                  <div
                    class="w-full max-w-3 rounded-t bg-[#00c471]/70"
                    :style="{
                      height: `${Math.max((point.wau / maxWau) * 100, point.wau ? 4 : 0)}%`,
                    }"
                    :title="`${point.day} · ${point.wau}`"
                  />
                </div>
              </div>
              <div
                class="mt-1.5 flex shrink-0 justify-between text-[11px] text-muted-foreground"
              >
                <span>{{ formatDay(overview?.points[0]?.day ?? '') }}</span>
                <span>{{ formatDay(overview?.points.at(-1)?.day ?? '') }}</span>
              </div>
            </div>

            <div
              class="flex flex-col overflow-hidden rounded-2xl bg-card sm:col-span-2 xl:col-span-1"
            >
              <div class="shrink-0 px-3 py-2.5 sm:px-4">
                <p class="text-[14px] font-semibold">최근 7일</p>
                <p class="text-[12px] text-muted-foreground">
                  DAU · WAU · MAU · 탈퇴
                </p>
              </div>
              <div class="overflow-x-auto">
                <table class="w-full text-left text-[13px]">
                  <thead class="text-muted-foreground">
                    <tr class="border-t border-border">
                      <th class="px-3 py-1.5 font-medium sm:px-4">날짜</th>
                      <th class="px-2 py-1.5 font-medium">DAU</th>
                      <th class="px-2 py-1.5 font-medium">WAU</th>
                      <th class="px-2 py-1.5 font-medium">MAU</th>
                      <th class="px-3 py-1.5 font-medium sm:px-4">탈퇴</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="point in recentDays"
                      :key="`row-${point.day}`"
                      class="border-t border-border"
                    >
                      <td class="px-3 py-1.5 font-medium sm:px-4">
                        {{ formatTableDay(point.day) }}
                      </td>
                      <td class="px-2 py-1.5 tabular-nums">{{ point.dau }}</td>
                      <td class="px-2 py-1.5 tabular-nums">{{ point.wau }}</td>
                      <td class="px-2 py-1.5 tabular-nums">{{ point.mau }}</td>
                      <td class="px-3 py-1.5 tabular-nums sm:px-4">
                        {{ point.withdrawn }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </template>
      </section>

      <section v-else class="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div
          class="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <FieldBar class="max-w-md flex-1">
            <Search class="ml-1 size-4 shrink-0 text-muted-foreground" />
            <Input
              v-model="query"
              class="h-10 min-w-0 flex-1 bg-transparent px-0 focus-visible:bg-transparent focus-visible:ring-0"
              placeholder="이름 또는 이메일"
            />
          </FieldBar>
          <form
            v-if="tab === 'admins'"
            class="flex min-w-0 gap-2 sm:min-w-[280px]"
            @submit.prevent="addAdmin"
          >
            <FieldBar class="min-w-0 flex-1">
              <Input
                v-model="adminEmail"
                type="email"
                required
                class="h-10 min-w-0 flex-1 bg-transparent px-0 focus-visible:bg-transparent focus-visible:ring-0"
                placeholder="관리자로 등록할 이메일"
                aria-label="관리자로 등록할 이메일"
              />
            </FieldBar>
            <Button type="submit" class="h-[52px] shrink-0 rounded-2xl px-5"
              >추가</Button
            >
          </form>
        </div>

        <div ref="listViewport" class="min-h-0 flex-1 overflow-y-auto">
          <Spinner
            v-if="loading && !users.length"
            class="rounded-2xl bg-card px-4 py-16"
          />
          <p
            v-else-if="!users.length"
            class="rounded-2xl bg-card px-4 py-12 text-center text-[15px] text-muted-foreground"
          >
            맞는 사용자가 없어요.
          </p>
          <div
            v-else
            class="divide-y divide-border overflow-hidden rounded-2xl bg-card"
          >
            <div
              v-for="row in users"
              :key="row.id"
              data-fit-row
              class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="min-w-0">
                <p class="flex min-w-0 items-center gap-1.5">
                  <span class="truncate text-[15px] font-semibold">{{
                    row.name
                  }}</span>
                  <template v-if="tab === 'users'">
                    <Badge
                      v-if="row.emailVerifiedAt"
                      class="shrink-0 bg-[#e8f8f0] text-[#03b26c] dark:bg-[#1a3d32] dark:text-[#3dd68c]"
                    >
                      인증됨
                    </Badge>
                    <Badge
                      v-else
                      class="shrink-0 bg-[#fff6d8] text-[#c78500] dark:bg-[#3d3420] dark:text-[#f5c84c]"
                    >
                      미인증
                    </Badge>
                    <Badge
                      v-if="row.suspendedAt"
                      class="shrink-0 bg-[#fff1f1] text-[#d63a48] dark:bg-[#3a1d22] dark:text-[#f08890]"
                    >
                      정지됨
                    </Badge>
                  </template>
                </p>
                <p class="truncate text-[13px] text-muted-foreground">
                  {{ row.email }}
                  <span class="text-[12px]"> · {{ formatJoined(row.createdAt) }} 가입</span>
                </p>
              </div>
              <div class="flex min-w-0 flex-wrap items-center gap-2">
                <template v-if="tab === 'users'">
                  <Button
                    variant="secondary"
                    size="sm"
                    :disabled="!row.emailVerifiedAt"
                    :aria-label="`${row.name}에게 비밀번호 재설정 메일 보내기`"
                    @click="sendPasswordReset(row)"
                  >
                    비밀번호 재설정 메일
                  </Button>
                  <Button
                    v-if="!row.suspendedAt"
                    variant="softDestructive"
                    size="sm"
                    @click="setSuspended(row, true)"
                  >
                    정지
                  </Button>
                  <Button
                    v-else
                    variant="secondary"
                    size="sm"
                    @click="setSuspended(row, false)"
                  >
                    해제
                  </Button>
                </template>
                <template v-else>
                  <Badge v-if="row.locked">초기 관리자</Badge>
                  <Badge v-else>관리자</Badge>
                  <Button
                    v-if="!row.locked"
                    variant="secondary"
                    size="sm"
                    @click="setAdmin(row, false)"
                  >
                    내리기
                  </Button>
                </template>
              </div>
            </div>
          </div>
        </div>
        <div class="flex min-h-9 shrink-0 items-center">
          <PaginationBar
            :page="userPage"
            :pages="userPages"
            :total="userTotal"
            noun="명"
            @update:page="
              (page) => {
                userPage = page
                void load()
              }
            "
          />
        </div>
      </section>
    </main>
  </AppShell>
</template>
