<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch } from 'vue'
import { DialogRoot } from 'reka-ui'
import { ChevronLeft, Plus, Search } from 'lucide-vue-next'
import { api } from '@/api'
import { errorMessage, initialOf } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import type { PageResult, Team } from '@/types/workspace'
import Button from '@/components/ui/button/Button.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import PaginationBar from '@/components/ui/pagination/PaginationBar.vue'
import Spinner from '@/components/ui/spinner/Spinner.vue'

const PAGE_SIZE = 8

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  select: [team: Team]
}>()

const auth = useAuthStore()
const mode = ref<'pick' | 'create'>('pick')
const query = ref('')
const search = ref('')
const teamName = ref('')
const page = ref(1)
const pages = ref(1)
const total = ref(0)
const teams = ref<Team[]>([])
const loading = ref(false)
const creating = ref(false)
const error = ref('')
let timer = 0

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: String(PAGE_SIZE),
    })
    if (search.value.trim()) params.set('q', search.value.trim())
    const result = await api<PageResult<Team>>(
      `/api/teams?${params}`,
      {},
      auth.token,
    )
    teams.value = result.items
    pages.value = result.pages
    total.value = result.total
  } catch (e) {
    error.value = errorMessage(e, '팀을 불러오지 못했어요')
  } finally {
    loading.value = false
  }
}

const reset = async () => {
  mode.value = 'pick'
  query.value = ''
  search.value = ''
  teamName.value = ''
  page.value = 1
  creating.value = false
  await load()
  await nextTick()
  document.querySelector<HTMLInputElement>('[data-team-pick-search]')?.focus()
}

const startCreate = async () => {
  mode.value = 'create'
  error.value = ''
  teamName.value = ''
  await nextTick()
  document.querySelector<HTMLInputElement>('[data-team-pick-create-name]')?.focus()
}

const backToPick = async () => {
  mode.value = 'pick'
  error.value = ''
  await nextTick()
  document.querySelector<HTMLInputElement>('[data-team-pick-search]')?.focus()
}

const setPage = (next: number) => {
  page.value = next
  void load()
}

watch(
  () => props.open,
  (open) => {
    if (open) void reset()
  },
)

watch(query, (value) => {
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    search.value = value
    page.value = 1
    void load()
  }, 250)
})

onUnmounted(() => window.clearTimeout(timer))

const pick = (team: Team) => {
  emit('select', team)
  emit('update:open', false)
}

const submitCreate = async () => {
  const name = teamName.value.trim()
  if (!name || creating.value) return
  creating.value = true
  error.value = ''
  try {
    const team = await api<Team>(
      '/api/teams',
      { method: 'POST', body: JSON.stringify({ name }) },
      auth.token,
    )
    pick(team)
  } catch (e) {
    error.value = errorMessage(e, '팀을 만들지 못했어요')
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogContent>
      <template #header>
        <DialogTitle>
          {{ mode === 'create' ? '팀 만들기' : '팀을 골라 주세요' }}
        </DialogTitle>
        <p class="mt-2 text-[15px] text-muted-foreground">
          {{
            mode === 'create'
              ? '새 팀을 만들고 이어서 프로젝트를 만들어요'
              : '이 프로젝트를 만들 팀이에요'
          }}
        </p>
      </template>

      <template v-if="mode === 'create'">
        <form class="space-y-5" @submit.prevent="submitCreate">
          <button
            type="button"
            class="inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            @click="backToPick"
          >
            <ChevronLeft class="size-3.5" />
            팀 목록
          </button>
          <div class="space-y-2">
            <Label for="team-pick-create-name">이름</Label>
            <Input
              id="team-pick-create-name"
              v-model="teamName"
              data-team-pick-create-name
              placeholder="예: 결제 스쿼드"
              autocomplete="off"
            />
          </div>
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          <Button
            type="submit"
            class="h-12 w-full"
            :disabled="creating || !teamName.trim()"
          >
            만들기
          </Button>
        </form>
      </template>

      <template v-else>
        <div class="flex h-11 items-center gap-2 rounded-2xl bg-muted px-3">
          <Search class="size-4 shrink-0 text-muted-foreground" />
          <input
            v-model="query"
            data-team-pick-search
            class="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            type="search"
            placeholder="팀 이름 검색"
            aria-label="팀 이름 검색"
          />
        </div>
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <div class="min-h-[16rem]">
          <Spinner
            v-if="loading && !teams.length"
            class="py-10"
            label="팀을 불러오고 있어요"
          />
          <p
            v-else-if="!teams.length"
            class="py-8 text-center text-[15px] text-muted-foreground"
          >
            {{
              search.trim()
                ? '맞는 팀이 없어요. 새로 만들어 보세요.'
                : '아직 팀이 없어요. 새로 만들어 주세요.'
            }}
          </p>
          <div v-else class="-mx-2">
            <button
              v-for="team in teams"
              :key="team.id"
              type="button"
              class="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors hover:bg-muted"
              @click="pick(team)"
            >
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[13px] font-bold text-primary"
              >
                {{ initialOf(team.name) }}
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[15px] font-semibold">
                  {{ team.name }}
                </span>
                <span class="block text-[13px] text-muted-foreground">
                  {{ team.members.length }}명 ·
                  {{ team._count?.projects ?? 0 }}개 프로젝트
                </span>
              </span>
            </button>
          </div>
        </div>
        <PaginationBar
          :page="page"
          :pages="pages"
          :total="total"
          noun="개 팀"
          @update:page="setPage"
        />
        <Button
          type="button"
          variant="secondary"
          class="h-12 w-full gap-1.5"
          @click="startCreate"
        >
          <Plus class="size-4" />
          새 팀 만들기
        </Button>
      </template>
    </DialogContent>
  </DialogRoot>
</template>
