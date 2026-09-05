import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from './prisma.service'
import { InvitationsService } from './invitations.service'
import { ProjectsService } from './projects.service'
import { CollabAclService } from './collab-acl.service'
import type { AuthUser } from '../common/auth/current-user'
import { userSelect } from '../common/access'
import { contains, pageResult, parsePage } from '../common/paging'

const memberUserInclude = {
  members: { include: { user: { select: userSelect } } },
} as const

@Injectable()
export class TeamsService {
  constructor(
    private prisma: PrismaService,
    private invitations: InvitationsService,
    private projects: ProjectsService,
    private collabAcl: CollabAclService,
  ) {}

  private getTeam = async (teamId: string) => {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    })
    if (!team) throw new NotFoundException('팀을 찾을 수 없습니다.')
    return team
  }

  private requireTeamMember = async (user: AuthUser, teamId: string) => {
    const team = await this.getTeam(teamId)
    const member = team.members.find((item) => item.userId === user.id)
    if (!member && team.ownerId !== user.id) {
      throw new NotFoundException('팀을 찾을 수 없습니다.')
    }
    return team
  }

  private assertOwner = (
    user: AuthUser,
    team: { ownerId: string },
    message: string,
  ) => {
    if (team.ownerId !== user.id) throw new ForbiddenException(message)
  }

  private assertCanManageMembers = (
    user: AuthUser,
    team: { ownerId: string; members: { userId: string; role: string }[] },
  ) => {
    const me = team.members.find((m) => m.userId === user.id)
    if (!me || (me.role !== 'owner' && team.ownerId !== user.id)) {
      throw new ForbiddenException('팀원을 관리할 권한이 없습니다.')
    }
  }

  list = async (user: AuthUser, query: { q?: string; page?: number; limit?: number } = {}) => {
    await this.projects.attachAccessibleOrphans(user)
    const q = query.q?.trim()
    const { skip, take, page, limit } = parsePage(query.page, query.limit, 5)
    const memberFilter = { members: { some: { userId: user.id } } }
    const where = q
      ? { AND: [memberFilter, { name: contains(q) }] }
      : memberFilter
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.team.findMany({
        where,
        include: {
          ...memberUserInclude,
          _count: { select: { projects: true } },
          invitations: {
            where: { acceptedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.team.count({ where }),
    ])
    return pageResult(
      rows.map(({ invitations, ...team }) => ({
        ...team,
        invitations: invitations.map((row) => this.invitations.toClient(row)),
      })),
      total,
      page,
      limit,
    )
  }

  get = async (user: AuthUser, teamId: string) => {
    await this.requireTeamMember(user, teamId)
    const row = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        ...memberUserInclude,
        _count: { select: { projects: true } },
        invitations: {
          where: { acceptedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    if (!row) throw new NotFoundException('팀을 찾을 수 없습니다.')
    const { invitations, ...team } = row
    return {
      ...team,
      invitations: invitations.map((item) => this.invitations.toClient(item)),
    }
  }

  rename = async (user: AuthUser, teamId: string, name: string) => {
    const team = await this.requireTeamMember(user, teamId)
    this.assertOwner(user, team, '소유자만 팀 이름을 바꿀 수 있어요.')
    const next = name.trim()
    if (!next) throw new BadRequestException('팀 이름을 적어 주세요.')
    await this.prisma.team.update({
      where: { id: teamId },
      data: { name: next },
    })
    return this.get(user, teamId)
  }

  create = (user: AuthUser, name: string) =>
    this.prisma.team.create({
      data: {
        name,
        ownerId: user.id,
        members: { create: { userId: user.id, role: 'owner' } },
      },
      include: memberUserInclude,
    })

  addMember = async (
    user: AuthUser,
    teamId: string,
    email: string,
    role = 'editor',
  ) => {
    const team = await this.requireTeamMember(user, teamId)
    this.assertCanManageMembers(user, team)
    const invitee = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })
    if (!invitee) {
      return this.invitations.invite({
        actor: user,
        email,
        role,
        target: { kind: 'team', name: team.name, teamId },
      })
    }
    if (invitee.id === team.ownerId)
      throw new ForbiddenException('소유자는 초대 대상이 아닙니다.')
    await this.prisma.invitation.updateMany({
      where: { email: invitee.email, teamId, acceptedAt: null },
      data: { acceptedAt: new Date() },
    })
    const member = await this.prisma.teamMember.upsert({
      where: { teamId_userId: { teamId, userId: invitee.id } },
      update: { role },
      create: { teamId, userId: invitee.id, role },
      include: { user: { select: userSelect } },
    })
    return { status: 'joined' as const, member }
  }

  resendInvite = async (user: AuthUser, teamId: string, inviteId: string) => {
    const team = await this.requireTeamMember(user, teamId)
    this.assertCanManageMembers(user, team)
    const invite = await this.prisma.invitation.findFirst({
      where: { id: inviteId, teamId, acceptedAt: null },
    })
    if (!invite) throw new NotFoundException('대기 중인 초대가 없어요.')
    return this.invitations.resend(invite.id, user)
  }

  revokeInvite = async (user: AuthUser, teamId: string, inviteId: string) => {
    const team = await this.requireTeamMember(user, teamId)
    this.assertCanManageMembers(user, team)
    const invite = await this.prisma.invitation.findFirst({
      where: { id: inviteId, teamId, acceptedAt: null },
    })
    if (!invite) throw new NotFoundException('대기 중인 초대가 없어요.')
    return this.invitations.revoke(invite.id)
  }

  updateMember = async (
    user: AuthUser,
    teamId: string,
    userId: string,
    role: string,
  ) => {
    const team = await this.requireTeamMember(user, teamId)
    this.assertCanManageMembers(user, team)
    if (userId === team.ownerId)
      throw new ForbiddenException('소유자 역할은 변경할 수 없습니다.')
    return this.prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId } },
      data: { role },
      include: { user: { select: userSelect } },
    }).then(async (member) => {
      await this.collabAcl.kickFromTeam(teamId, userId)
      return member
    })
  }

  leave = async (user: AuthUser, teamId: string) => {
    const team = await this.requireTeamMember(user, teamId)
    if (team.ownerId === user.id) {
      throw new ForbiddenException(
        '소유자는 팀을 나갈 수 없습니다. 팀을 삭제하세요.',
      )
    }
    const member = team.members.find((m) => m.userId === user.id)
    if (!member) throw new NotFoundException('팀원이 아닙니다.')
    await this.prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId: user.id } },
    })
    await this.collabAcl.kickFromTeam(teamId, user.id)
    return { ok: true }
  }

  remove = async (user: AuthUser, teamId: string) => {
    const team = await this.requireTeamMember(user, teamId)
    this.assertOwner(user, team, '소유자만 팀을 삭제할 수 있습니다.')
    const projectCount = await this.prisma.project.count({ where: { teamId } })
    if (projectCount > 0) {
      throw new BadRequestException(
        '팀에 프로젝트가 있으면 삭제할 수 없어요. 프로젝트를 먼저 삭제해 주세요.',
      )
    }
    await this.prisma.team.delete({ where: { id: teamId } })
    return { ok: true }
  }

  removeMember = async (user: AuthUser, teamId: string, userId: string) => {
    const team = await this.requireTeamMember(user, teamId)
    this.assertOwner(user, team, '소유자만 팀원을 제거할 수 있습니다.')
    if (userId === team.ownerId)
      throw new ForbiddenException('소유자는 제거할 수 없습니다.')
    await this.prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    })
    await this.collabAcl.kickFromTeam(teamId, userId)
    return { ok: true }
  }
}
