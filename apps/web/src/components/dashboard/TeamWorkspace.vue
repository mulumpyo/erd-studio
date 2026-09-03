<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { FolderKanban, Users } from 'lucide-vue-next'
import { api } from '@/api'
import { errorMessage, initialOf, roleLabel } from '@/lib/format'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/composables/useToast'
import { confirm } from '@/composables/useConfirm'
import {
  canDeleteProject,
  canLeaveProject,
  type PageResult,
  type PendingInvitation,
  type Project,
  type Team,
} from '@/types/workspace'
import PaginationBar from '@/components/ui/pagination/PaginationBar.vue'
import Avatar from '@/components/ui/avatar/Avatar.vue'
import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import Card from '@/components/ui/card/Card.vue'
import CardContent from '@/components/ui/card/CardContent.vue'
import CardHeader from '@/components/ui/card/CardHeader.vue'
import CardTitle from '@/components/ui/card/CardTitle.vue'
import FieldBar from '@/components/ui/field-bar/FieldBar.vue'
import Input from '@/components/ui/input/Input.vue'
import Select from '@/components/ui/select/Select.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'

const props = defineProps<{
  team: Team
  query?: string
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
const inviteEmail = ref('')
const inviteRole = ref('editor')
const projectName = ref('')
const error = ref('')
const inviting = ref(false)
const projects = ref<Project[]>([])
const projectPage = ref(1)
const projectPages = ref(1)
const projectTotal = ref(0)
const loadingProjects = ref(false)
const isOwner = computed(() => props.team.ownerId === auth.user?.id)
const pendingInvites = computed(() => props.team.invitations ?? [])
const projectQuery = computed(() => {
  const q = props.query?.trim() ?? ''
  if (!q) return ''
  if (props.team.name.toLowerCase().includes(q.toLowerCase())) return ''
  return q
})

const sortedMembers = computed(() =>
  [...props.team.members].sort((a, b) => {
    if (a.userId === props.team.ownerId) return -1
    if (b.userId === props.team.ownerId) return 1
    return a.user.name.localeCompare(b.user.name, 'ko')
  }),
)

const initial = computed(() => initialOf(props.team.name) || 'T')

const loadProjects = async () => {
  loadingProjects.value = true
  try {
    const params = new URLSearchParams({
      teamId: props.team.id,
      page: String(projectPage.value),
      limit: '8',
    })
    if (projectQuery.value) params.set('q', projectQuery.value)
    const result = await api<PageResult<Project>>(
      `/api/projects?${params}`,
      {},
      auth.token,
    )
    projects.value = result.items
    projectPages.value = result.pages
    projectTotal.value = result.total
  } catch (e) {
    error.value = errorMessage(e, '프로젝트를 불러오지 못했어요')
  } finally {
    loadingProjects.value = false
  }
}

watch(
  () => [props.team.id, projectQuery.value, props.revision] as const,
  () => {
    projectPage.value = 1
    void loadProjects()
  },
  { immediate: true },
)

const setProjectPage = (next: number) => {
  projectPage.value = next
  void loadProjects()
}

const invite = async () => {
  const email = inviteEmail.value.trim()
  if (!email) return
  error.value = ''
  inviting.value = true
  try {
    const result = await api<
      | { status: 'joined' }
      | { status: 'invited'; mailed: boolean }
    >(
      `/api/teams/${props.team.id}/members`,
      {
        method: 'POST',
        body: JSON.stringify({ email, role: inviteRole.value }),
      },
      auth.token,
    )
    inviteEmail.value = ''
    toast(
      result.status === 'joined'
        ? '팀원으로 추가했어요'
        : result.mailed
          ? '초대 메일을 보냈어요'
          : '아직 가입하지 않은 분이에요. 링크를 복사해 초대해 주세요.',
    )
    emit('changed')
  } catch (e) {
    error.value = errorMessage(e, '초대하지 못했어요')
  } finally {
    inviting.value = false
  }
}

const changeRole = async (userId: string, role: string) => {
  error.value = ''
  try {
    await api(
      `/api/teams/${props.team.id}/members/${userId}`,
      { method: 'PATCH', body: JSON.stringify({ role }) },
      auth.token,
    )
    emit('changed')
  } catch (e) {
    error.value = errorMessage(e, '역할을 바꾸지 못했어요')
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
  error.value = ''
  try {
    await api(
      `/api/teams/${props.team.id}/members/${userId}`,
      { method: 'DELETE' },
      auth.token,
    )
    emit('changed')
  } catch (e) {
    error.value = errorMessage(e, '내보내지 못했어요')
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

const create = (fromSample: boolean) => {
  emit(
    'create',
    fromSample,
    projectName.value.trim() || `${props.team.name} ERD`,
  )
  projectName.value = ''
}
</script>

<template>
  <Card class="overflow-hidden">
    <CardHeader
      class="flex-row items-start justify-between space-y-0 bg-muted/60"
    >
      <div class="flex items-center gap-3">
        <Avatar class="size-10 text-sm">{{ initial }}</Avatar>
        <div class="space-y-1">
          <CardTitle>{{ team.name }}</CardTitle>
          <p class="text-sm text-muted-foreground">
            {{ team.members.length }}명 · {{ team._count?.projects ?? projectTotal }}개 프로젝트
          </p>
        </div>
      </div>
      <Button
        v-if="isOwner"
        variant="softDestructive"
        size="sm"
        @click="emit('remove-team')"
      >
        삭제
      </Button>
      <Button v-else variant="ghost" size="sm" @click="emit('leave-team')">
        나가기
      </Button>
    </CardHeader>
    <CardContent class="p-0">
      <div class="grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,22rem)]">
        <section class="space-y-4 p-4 sm:p-6">
          <div class="flex items-center gap-2">
            <FolderKanban class="size-4 text-muted-foreground" />
            <h3 class="text-sm font-semibold">프로젝트</h3>
          </div>
          <div v-if="loadingProjects" class="rounded-[20px] bg-muted px-3 py-8 text-center text-[15px] text-muted-foreground">
            프로젝트를 불러오는 중이에요.
          </div>
          <template v-else-if="projects.length">
          <div class="overflow-hidden rounded-2xl bg-muted/70">
            <Table>
              <TableHeader>
                <TableRow class="hover:bg-transparent">
                  <TableHead>이름</TableHead>
                  <TableHead class="hidden md:table-cell">설명</TableHead>
                  <TableHead class="hidden sm:table-cell">수정</TableHead>
                  <TableHead class="w-16">멤버</TableHead>
                  <TableHead class="w-20 text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="p in projects" :key="p.id">
                  <TableCell>
                    <RouterLink
                      class="font-medium hover:underline"
                      :to="`/app/${p.id}`"
                    >
                      {{ p.name }}
                    </RouterLink>
                    <div v-if="p.tags?.length" class="mt-1 flex flex-wrap gap-1">
                      <Badge
                        v-for="tag in p.tags"
                        :key="tag"
                        class="bg-[#e8f3ff] text-[#1b64da]"
                        >#{{ tag }}</Badge
                      >
                    </div>
                  </TableCell>
                  <TableCell class="hidden max-w-[16rem] text-muted-foreground md:table-cell">
                    <span class="line-clamp-2">{{ p.description || '—' }}</span>
                  </TableCell>
                  <TableCell class="hidden text-muted-foreground sm:table-cell">
                    {{ new Date(p.updatedAt).toLocaleString() }}
                  </TableCell>
                  <TableCell>
                    <Badge>{{ team.members.length }}</Badge>
                  </TableCell>
                  <TableCell class="text-right">
                    <Button
                      v-if="canDeleteProject(p, auth.user?.id, team.ownerId)"
                      variant="softDestructive"
                      size="sm"
                      @click="emit('remove-project', p.id)"
                    >
                      삭제
                    </Button>
                    <Button
                      v-else-if="canLeaveProject(p, auth.user?.id)"
                      variant="ghost"
                      size="sm"
                      @click="emit('leave-project', p.id)"
                    >
                      나가기
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <PaginationBar
            :page="projectPage"
            :pages="projectPages"
            :total="projectTotal"
            noun="개 프로젝트"
            @update:page="setProjectPage"
          />
          </template>
          <p
            v-else
            class="rounded-[20px] bg-muted px-3 py-8 text-center text-[15px] text-muted-foreground"
          >
            {{
              projectQuery
                ? '이 팀에서 검색과 맞는 프로젝트가 없어요.'
                : '아직 프로젝트가 없어요.'
            }}
          </p>
          <form class="w-full" @submit.prevent="create(false)">
            <FieldBar>
              <Input
                v-model="projectName"
                class="h-10 min-w-0 flex-1 bg-transparent px-0 focus-visible:bg-transparent focus-visible:ring-0"
                placeholder="새 프로젝트 이름"
                aria-label="새 프로젝트 이름"
              />
              <Button type="submit" class="h-10 shrink-0 px-4">새로 만들기</Button>
              <Button
                type="button"
                variant="secondary"
                class="h-10 shrink-0 px-4"
                @click="create(true)"
                >샘플로 시작</Button
              >
            </FieldBar>
          </form>
        </section>
        <section
          class="space-y-4 bg-muted/50 p-4 sm:p-6 lg:border-l-0"
        >
          <div class="flex items-center gap-2">
            <Users class="size-4 text-muted-foreground" />
            <h3 class="text-sm font-semibold">팀원</h3>
          </div>
          <ul class="space-y-2">
            <li
              v-for="m in sortedMembers"
              :key="m.userId"
              class="rounded-2xl bg-card px-3 py-2.5"
            >
              <div class="flex items-center gap-2">
                <Avatar class="size-8">{{ initialOf(m.user.name) }}</Avatar>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium">
                    {{ m.user.name }}
                  </div>
                  <div class="truncate text-xs text-muted-foreground">
                    {{ m.user.email }}
                  </div>
                </div>
                <Badge v-if="m.userId === team.ownerId">소유자</Badge>
                <Badge v-else-if="!isOwner">{{ roleLabel(m.role) }}</Badge>
              </div>
              <div
                v-if="isOwner && m.userId !== team.ownerId"
                class="mt-2 flex items-center justify-end gap-1"
              >
                <Select
                  :model-value="m.role"
                  class="h-8 w-auto text-xs"
                  @update:model-value="changeRole(m.userId, String($event))"
                >
                  <option value="editor">편집</option>
                  <option value="viewer">보기</option>
                </Select>
                <Button
                  variant="ghostDestructive"
                  size="sm"
                  @click="removeMember(m.userId, m.user.name)"
                >
                  내보내기
                </Button>
              </div>
            </li>
          </ul>
          <ul v-if="isOwner && pendingInvites.length" class="space-y-2">
            <li
              v-for="pending in pendingInvites"
              :key="pending.id"
              class="rounded-2xl bg-card px-3 py-2.5"
            >
              <div class="flex items-center gap-2">
                <Avatar class="size-8">{{ pending.email.slice(0, 1).toUpperCase() }}</Avatar>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium">{{ pending.email }}</div>
                  <div class="text-xs text-muted-foreground">초대 대기</div>
                </div>
                <Badge>{{ roleLabel(pending.role) }}</Badge>
              </div>
              <div class="mt-2 flex items-center justify-end gap-1">
                <Button
                  v-if="pending.inviteUrl"
                  variant="ghost"
                  size="sm"
                  @click="pending.inviteUrl && copyInvite(pending.inviteUrl)"
                >
                  링크
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  @click="resendInvite(pending)"
                >
                  재발송
                </Button>
                <Button
                  variant="ghostDestructive"
                  size="sm"
                  @click="revokeInvite(pending)"
                >
                  취소
                </Button>
              </div>
            </li>
          </ul>
          <div v-if="isOwner" class="space-y-2">
            <FieldBar>
              <Input
                v-model="inviteEmail"
                class="h-10 min-w-0 flex-1 bg-transparent px-0 focus-visible:bg-transparent focus-visible:ring-0"
                placeholder="이메일 주소"
                aria-label="팀원 이메일"
                @keydown.enter.prevent="invite"
              />
              <Select
                v-model="inviteRole"
                class="h-10 w-auto shrink-0 bg-transparent px-2 focus-visible:bg-transparent focus-visible:ring-0"
              >
                <option value="editor">편집</option>
                <option value="viewer">보기</option>
              </Select>
              <Button
                class="h-10 shrink-0 px-4"
                :disabled="inviting"
                @click="invite"
              >
                초대
              </Button>
            </FieldBar>
            <p class="text-xs text-muted-foreground">
              아직 회원이 아니면 초대 메일을 보내요.
            </p>
          </div>
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        </section>
      </div>
    </CardContent>
  </Card>
</template>
