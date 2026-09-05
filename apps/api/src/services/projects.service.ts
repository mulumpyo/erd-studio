import { randomBytes } from 'node:crypto'
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { emptyDocument, sampleDocument, captureVersionSnapshot, documentFromVersionSnapshot, normalizeVersionSnapshot } from '@erd-studio/shared'
import { contains, pageResult, parsePage } from '../common/paging'
import { Prisma } from '@prisma/client'
import { PrismaService } from './prisma.service'
import { InvitationsService } from './invitations.service'
import { CollabAclService } from './collab-acl.service'
import { NotifyService } from './notify.service'
import type { AuthUser } from '../common/auth/current-user'
import {
  assertDeleteProject,
  assertDirectProjectMembers,
  assertEdit,
  assertManageMembers,
  assertParticipant,
  assertView,
  canEditProject,
  isProjectParticipant,
  isTeamOwned,
  projectAccessInclude,
  userSelect,
  type ProjectAccess,
} from '../common/access'

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private invitations: InvitationsService,
    private collabAcl: CollabAclService,
    private notify: NotifyService,
  ) {}

  attachAccessibleOrphans = async (user: AuthUser) => {
    const rows = await this.prisma.project.findMany({
      where: {
        teamId: null,
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      include: projectAccessInclude,
    })
    for (const row of rows) await this.ensureProjectTenant(row)
  }

  list = async (
    user: AuthUser,
    query: { q?: string; page?: number; limit?: number; teamId?: string } = {},
  ) => {
    await this.attachAccessibleOrphans(user)
    if (query.teamId) {
      const member = await this.prisma.teamMember.findUnique({
        where: {
          teamId_userId: { teamId: query.teamId, userId: user.id },
        },
      })
      if (!member) throw new NotFoundException('팀을 찾을 수 없습니다.')
    }
    const q = query.q?.trim()
    const { skip, take, page, limit } = parsePage(query.page, query.limit, 8)
    const access = {
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
        { team: { members: { some: { userId: user.id } } } },
      ],
    }
    const search = q
      ? {
          OR: [
            { name: contains(q) },
            { description: contains(q) },
            { tags: { has: q } },
          ],
        }
      : undefined
    const where = {
      AND: [
        access,
        query.teamId ? { teamId: query.teamId } : {},
        search ?? {},
      ],
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: {
          team: { select: { id: true, name: true } },
          members: { include: { user: { select: userSelect } } },
          _count: { select: { members: true } },
        },
        omit: { yjsState: true, snapshot: true, shareToken: true },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.project.count({ where }),
    ])
    return pageResult(rows, total, page, limit)
  }

  create = async (
    user: AuthUser,
    name: string,
    teamId?: string,
    fromSample = false,
  ) => {
    const resolvedTeamId = teamId
      ? (await this.assertTeamMember(user.id, teamId), teamId)
      : (await this.findOrCreateOwnerTeam(user.id, user.name)).id
    const project = await this.prisma.project.create({
      data: {
        name,
        ownerId: user.id,
        teamId: resolvedTeamId,
        snapshot: fromSample ? (sampleDocument() as object) : emptyDocument(),
        members: { create: { userId: user.id, role: 'owner' } },
      },
      include: { members: { include: { user: { select: userSelect } } } },
    })
    await this.notify.publishProjectChange(resolvedTeamId, undefined, project.id)
    return project
  }

  get = async (user: AuthUser | null | undefined, id: string) => {
    const project = await this.requireAccess(user, id)
    return this.presentProject(user, project)
  }

  requireAccess = async (user: AuthUser | null | undefined, id: string) => {
    const project = await this.ensureProjectTenant(
      await this.prisma.project.findUnique({
        where: { id },
        include: projectAccessInclude,
      }),
    )
    if (!project) throw new NotFoundException('프로젝트를 찾을 수 없습니다.')
    assertView(user, project)
    return project
  }

  getByShareToken = async (token: string) => {
    const project = await this.prisma.project.findUnique({
      where: { shareToken: token },
      select: {
        id: true,
        name: true,
        isPublic: true,
      },
    })
    if (!project || !project.isPublic)
      throw new NotFoundException('공개된 다이어그램이 아닙니다.')
    return project
  }

  updateMeta = async (
    user: AuthUser,
    id: string,
    data: {
      name?: string
      isPublic?: boolean
      description?: string
      tags?: string[]
    },
  ) => {
    const project = await this.requireAccess(user, id)
    assertEdit(user, project)
    if (data.isPublic !== undefined && project.ownerId !== user.id) {
      throw new ForbiddenException('공개 설정은 소유자만 바꿀 수 있어요.')
    }
    const unpublishing = data.isPublic === false && project.isPublic
    const nextName = data.name?.trim()
    const nameChanged = Boolean(nextName && nextName !== project.name)
    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        name: data.name,
        isPublic: data.isPublic,
        shareToken: unpublishing ? newShareToken() : undefined,
        description:
          data.description === undefined
            ? undefined
            : data.description.trim() || null,
        tags: data.tags ? this.cleanTags(data.tags) : undefined,
      },
    })
    if (nameChanged && project.teamId) {
      await this.notify.publishProjectChange(project.teamId, undefined, id, false)
    }
    return updated
  }

  saveSnapshot = async (user: AuthUser, id: string, snapshot: object) => {
    const project = await this.requireAccess(user, id)
    assertEdit(user, project)
    return this.prisma.project.update({ where: { id }, data: { snapshot } })
  }

  remove = async (user: AuthUser, id: string) => {
    const project = await this.requireAccess(user, id)
    assertDeleteProject(user, project)
    await this.prisma.project.delete({ where: { id } })
    await this.collabAcl.kickFromProject(id)
    if (project.teamId) {
      await this.notify.publishProjectChange(project.teamId, undefined, id)
    }
    return { ok: true }
  }

  leave = async (user: AuthUser, id: string) => {
    const project = await this.requireAccess(user, id)
    if (project.ownerId === user.id) {
      throw new ForbiddenException(
        '소유자는 프로젝트를 나갈 수 없습니다. 프로젝트를 삭제하세요.',
      )
    }
    const member = project.members.find((m) => m.userId === user.id)
    if (!member) {
      throw new ForbiddenException(
        '초대된 팀원만 프로젝트를 나갈 수 있습니다. 팀 소속이면 팀에서 나가세요.',
      )
    }
    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId: id, userId: user.id } },
    })
    await this.collabAcl.kickFromProject(id, user.id)
    if (project.teamId) {
      await this.notify.publishProjectChange(project.teamId, user.id, id)
    }
    return { ok: true }
  }

  versions = async (user: AuthUser, id: string) => {
    const project = await this.requireAccess(user, id)
    assertParticipant(user, project)
    return this.prisma.projectVersion.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        label: true,
        createdAt: true,
        createdById: true,
        createdBy: { select: { id: true, name: true } },
      },
    })
  }

  getVersion = async (user: AuthUser, id: string, versionId: string) => {
    const project = await this.requireAccess(user, id)
    assertParticipant(user, project)
    const version = await this.prisma.projectVersion.findFirst({
      where: { id: versionId, projectId: id },
      include: { createdBy: { select: { id: true, name: true } } },
    })
    if (!version) throw new NotFoundException('버전을 찾을 수 없습니다.')
    const frozen = normalizeVersionSnapshot(version.snapshot)
    return {
      id: version.id,
      projectId: version.projectId,
      name: version.label,
      createdAt: version.createdAt,
      createdBy: version.createdBy,
      databaseModelSnapshot: frozen.databaseModel,
      canvasSnapshot: frozen.canvas,
    }
  }

  snapshotVersion = async (
    user: AuthUser,
    id: string,
    label?: string,
    document?: object,
  ) => {
    const project = await this.requireAccess(user, id)
    assertEdit(user, project)
    const frozen = captureVersionSnapshot(
      (document as never) ?? (project.snapshot as never) ?? emptyDocument(),
    )
    return this.prisma.projectVersion.create({
      data: {
        projectId: id,
        snapshot: frozen as object,
        label: label || new Date().toISOString(),
        createdById: user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    })
  }

  restoreVersion = async (user: AuthUser, id: string, versionId: string) => {
    const project = await this.requireAccess(user, id)
    assertEdit(user, project)
    const version = await this.prisma.projectVersion.findFirst({
      where: { id: versionId, projectId: id },
    })
    if (!version) throw new NotFoundException('버전을 찾을 수 없습니다.')
    const document = documentFromVersionSnapshot(version.snapshot)
    return this.prisma.project.update({
      where: { id },
      data: { snapshot: document as object, yjsState: null },
    })
  }

  listMembers = async (user: AuthUser, id: string) => {
    const project = await this.requireAccess(user, id)
    assertParticipant(user, project)
    if (isTeamOwned(project) && project.team) {
      return {
        kind: 'team' as const,
        team: {
          id: project.team.id,
          name: project.team.name,
          ownerId: project.team.ownerId,
        },
        members: project.team.members.map((m) => ({
          userId: m.userId,
          role: m.userId === project.ownerId ? 'owner' : m.role,
          user: m.user,
        })),
        invitations: [],
      }
    }
    await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: id, userId: project.ownerId } },
      update: {},
      create: { projectId: id, userId: project.ownerId, role: 'owner' },
    })
    const members = await this.prisma.projectMember.findMany({
      where: { projectId: id },
      include: { user: { select: userSelect } },
      orderBy: { joinedAt: 'asc' },
    })
    return {
      kind: 'project' as const,
      team: null,
      members,
      invitations: await this.invitations.listPendingForProject(id),
    }
  }

  addMember = async (
    user: AuthUser,
    id: string,
    email: string,
    role = 'editor',
  ) => {
    const project = await this.requireAccess(user, id)
    assertDirectProjectMembers(project)
    assertManageMembers(user, project)
    const invitee = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })
    if (invitee?.id === project.ownerId) {
      throw new ForbiddenException('소유자는 이미 팀원입니다.')
    }
    if (invitee) {
      const member = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: id, userId: invitee.id } },
      })
      if (member) throw new ForbiddenException('이미 팀원이에요.')
    }
    return this.invitations.invite({
      actor: user,
      email,
      role,
      target: { kind: 'project', name: project.name, projectId: id },
    })
  }

  resendInvite = async (user: AuthUser, id: string, inviteId: string) => {
    const project = await this.requireAccess(user, id)
    assertDirectProjectMembers(project)
    assertManageMembers(user, project)
    const invite = await this.prisma.invitation.findFirst({
      where: { id: inviteId, projectId: id, acceptedAt: null },
    })
    if (!invite) throw new NotFoundException('대기 중인 초대가 없어요.')
    return this.invitations.resend(invite.id, user)
  }

  revokeInvite = async (user: AuthUser, id: string, inviteId: string) => {
    const project = await this.requireAccess(user, id)
    assertDirectProjectMembers(project)
    assertManageMembers(user, project)
    const invite = await this.prisma.invitation.findFirst({
      where: { id: inviteId, projectId: id, acceptedAt: null },
    })
    if (!invite) throw new NotFoundException('대기 중인 초대가 없어요.')
    return this.invitations.revoke(invite.id)
  }

  updateMember = async (
    user: AuthUser,
    id: string,
    userId: string,
    role: string,
  ) => {
    const project = await this.requireAccess(user, id)
    assertDirectProjectMembers(project)
    assertManageMembers(user, project)
    if (userId === project.ownerId)
      throw new ForbiddenException('소유자 역할은 변경할 수 없습니다.')
    if (role !== 'editor' && role !== 'viewer') {
      throw new ForbiddenException('역할은 편집 또는 보기만 가능해요.')
    }
    return this.prisma.projectMember.update({
      where: { projectId_userId: { projectId: id, userId } },
      data: { role },
      include: { user: { select: userSelect } },
    }).then(async (member) => {
      await this.collabAcl.kickFromProject(id, userId)
      if (project.teamId) {
        await this.notify.publishProjectChange(project.teamId, undefined, id, false)
      }
      return member
    })
  }

  removeMember = async (user: AuthUser, id: string, userId: string) => {
    const project = await this.requireAccess(user, id)
    assertDirectProjectMembers(project)
    assertManageMembers(user, project)
    if (userId === project.ownerId)
      throw new ForbiddenException('소유자는 제거할 수 없습니다.')
    await this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId: id, userId } },
    })
    await this.collabAcl.kickFromProject(id, userId)
    if (project.teamId) {
      await this.notify.publishProjectChange(project.teamId, userId, id)
    }
    return { ok: true }
  }

  private presentProject = (
    user: AuthUser | null | undefined,
    project: ProjectAccess & {
      id: string
      name: string
      description?: string | null
      tags?: string[]
      snapshot?: unknown
      createdAt: Date
      updatedAt: Date
      owner?: { id: string; name: string; email?: string }
      yjsState?: unknown
      shareToken?: string
      team?: { id: string; name: string; ownerId?: string; members: unknown[] } | null
    },
  ) => {
    const participant = isProjectParticipant(user, project)
    const canEdit = Boolean(user && canEditProject(user, project))
    if (participant) {
      const safe = { ...project }
      delete safe.yjsState
      delete safe.shareToken
      return {
        ...safe,
        isParticipant: true,
        canEdit,
      }
    }
    return {
      id: project.id,
      name: project.name,
      description: project.description ?? null,
      tags: project.tags ?? [],
      isPublic: Boolean(project.isPublic),
      ownerId: project.ownerId,
      owner: project.owner
        ? { id: project.owner.id, name: project.owner.name }
        : undefined,
      snapshot: project.snapshot,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      team: null,
      members: [],
      isParticipant: false,
      canEdit: false,
    }
  }

  private findOrCreateOwnerTeam = async (userId: string, name: string) => {
    const existing = await this.prisma.team.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
    })
    if (existing) {
      await this.prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: existing.id, userId } },
        update: {},
        create: { teamId: existing.id, userId, role: 'owner' },
      })
      return existing
    }
    return this.prisma.team.create({
      data: {
        name: `${name.trim() || '내'} 팀`,
        ownerId: userId,
        members: { create: { userId, role: 'owner' } },
      },
    })
  }

  private ensureProjectTenant = async (
    project: Prisma.ProjectGetPayload<{
      include: typeof projectAccessInclude
    }> | null,
  ) => {
    if (!project) return project
    if (project.teamId) return project
    const team = await this.prisma.team.create({
      data: {
        name: `${project.name.trim() || '프로젝트'} 팀`.slice(0, 80),
        ownerId: project.ownerId,
        members: { create: { userId: project.ownerId, role: 'owner' } },
      },
    })
    await this.prisma.project.update({
      where: { id: project.id },
      data: { teamId: team.id },
    })
    for (const member of project.members ?? []) {
      await this.prisma.teamMember.upsert({
        where: {
          teamId_userId: { teamId: team.id, userId: member.userId },
        },
        update: {},
        create: {
          teamId: team.id,
          userId: member.userId,
          role: member.userId === project.ownerId ? 'owner' : member.role,
        },
      })
    }
    return this.prisma.project.findUniqueOrThrow({
      where: { id: project.id },
      include: projectAccessInclude,
    })
  }

  private cleanTags = (tags: string[]) => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const raw of tags) {
      const tag = raw.trim().replace(/^#/, '').slice(0, 24)
      if (!tag) continue
      const key = tag.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(tag)
      if (out.length >= 12) break
    }
    return out
  }

  private assertTeamMember = async (userId: string, teamId: string) => {
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    })
    if (!member)
      throw new ForbiddenException('팀원만 팀 프로젝트를 만들 수 있습니다.')
    if (member.role === 'viewer') {
      throw new ForbiddenException(
        '보기 권한으로는 프로젝트를 만들 수 없습니다.',
      )
    }
  }
}

const newShareToken = () => randomBytes(16).toString('base64url')
