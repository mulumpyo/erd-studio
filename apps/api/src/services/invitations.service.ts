import { randomBytes } from 'node:crypto'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import type { Invitation } from '@prisma/client'
import { PrismaService } from './prisma.service'
import { MailService } from './mail.service'
import type { AuthUser } from '../common/auth/current-user'
import { userSelect } from '../common/access'
import { hashSecret, looksLikeSha256Hex, secretLookupValues } from '../common/token-hash'
import { webOrigin } from '../common/urls'
import { inviteStatus } from './invite-status'
import { NotifyService } from './notify.service'

const INVITE_DAYS = 7

export type PendingInvitationDto = {
  id: string
  email: string
  name?: string | null
  role: string
  expiresAt: Date
  createdAt: Date
  inviteUrl?: string
}

type InviteTarget = {
  kind: 'team' | 'project'
  name: string
  teamId?: string
  projectId?: string
}

@Injectable()
export class InvitationsService implements OnModuleInit {
  private readonly logger = new Logger(InvitationsService.name)

  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private notify: NotifyService,
  ) {}

  onModuleInit = () => this.rotatePlaintextInvites()

  inviteUrl = (token: string) => `${webOrigin()}/invite/${token}`

  toClient = (
    invite: Invitation,
    rawToken?: string,
    name?: string | null,
  ): PendingInvitationDto => ({
    id: invite.id,
    email: invite.email,
    name: name ?? null,
    role: invite.role,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    ...(rawToken ? { inviteUrl: this.inviteUrl(rawToken) } : {}),
  })

  withNames = async (invites: Invitation[]) => {
    const emails = [...new Set(invites.map((row) => row.email.toLowerCase()))]
    const users = emails.length
      ? await this.prisma.user.findMany({
          where: { email: { in: emails } },
          select: { email: true, name: true },
        })
      : []
    const names = new Map(users.map((row) => [row.email.toLowerCase(), row.name]))
    return invites.map((row) =>
      this.toClient(row, undefined, names.get(row.email.toLowerCase()) ?? null),
    )
  }

  listPendingForTeam = (teamId: string) =>
    this.prisma.invitation
      .findMany({
        where: pendingWhere({ teamId }),
        orderBy: { createdAt: 'desc' },
      })
      .then((rows) => this.withNames(rows))

  listPendingForProject = (projectId: string) =>
    this.prisma.invitation
      .findMany({
        where: pendingWhere({ projectId }),
        orderBy: { createdAt: 'desc' },
      })
      .then((rows) => this.withNames(rows))

  invite = async (opts: {
    actor: AuthUser
    email: string
    role: string
    target: InviteTarget
  }) => {
    const email = opts.email.trim().toLowerCase()
    if (!email) throw new BadRequestException('이메일을 입력해 주세요.')
    if (email === opts.actor.email.toLowerCase()) {
      throw new BadRequestException('자기 자신은 초대할 수 없어요.')
    }
    const existing = await this.prisma.invitation.findFirst({
      where: {
        email,
        acceptedAt: null,
        teamId: opts.target.teamId ?? null,
        projectId: opts.target.projectId ?? null,
      },
    })
    const rawToken = newToken()
    const token = hashSecret(rawToken)
    const expiresAt = expiresInDays(INVITE_DAYS)
    const invite = existing
      ? await this.prisma.invitation.update({
          where: { id: existing.id },
          data: {
            role: opts.role,
            token,
            expiresAt,
            invitedById: opts.actor.id,
            declinedAt: null,
            inviterReadAt: null,
          },
        })
      : await this.prisma.invitation.create({
          data: {
            token,
            email,
            role: opts.role,
            kind: opts.target.kind,
            teamId: opts.target.teamId,
            projectId: opts.target.projectId,
            invitedById: opts.actor.id,
            expiresAt,
          },
        })
    const mailed = await this.mail.sendInvite({
      to: email,
      inviterName: opts.actor.name,
      workspaceName: opts.target.name,
      roleLabel: roleLabel(opts.role),
      url: this.inviteUrl(rawToken),
      expiresAt: invite.expiresAt,
    })
    await this.notify.publishInvite(email)
    return {
      status: 'invited' as const,
      invitation: this.toClient(invite, rawToken),
      mailed,
    }
  }

  preview = async (token: string) => {
    const invite = await this.findByToken(token)
    const status = inviteStatus(invite)
    return {
      email: invite.email,
      role: invite.role,
      kind: invite.kind,
      workspaceName: invite.team?.name ?? invite.project?.name ?? '',
      inviterName: invite.invitedBy.name,
      inviterEmail: invite.invitedBy.email,
      expiresAt: invite.expiresAt,
      status,
      teamId: invite.teamId,
      projectId: invite.projectId,
    }
  }

  listMine = async (user: AuthUser) => {
    const email = user.email.toLowerCase()
    const [incoming, replies] = await Promise.all([
      this.prisma.invitation.findMany({
        where: { email, ...pendingWhere({}) },
        orderBy: { createdAt: 'desc' },
        include: inviteInclude,
      }),
      this.prisma.invitation.findMany({
        where: {
          invitedById: user.id,
          inviterReadAt: null,
          OR: [
            { declinedAt: { not: null } },
            { acceptedAt: { not: null } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        include: inviteInclude,
      }),
    ])
    const inviteeEmails = [...new Set(replies.map((row) => row.email))]
    const invitees = inviteeEmails.length
      ? await this.prisma.user.findMany({
          where: { email: { in: inviteeEmails } },
          select: { email: true, name: true },
        })
      : []
    const names = new Map(invitees.map((row) => [row.email, row.name]))
    return [
      ...incoming.map((row) => ({
        id: row.id,
        type: 'incoming' as const,
        kind: row.kind,
        role: row.role,
        workspaceName: row.project?.name ?? row.team?.name ?? '',
        inviterName: row.invitedBy.name,
        inviterEmail: row.invitedBy.email,
        inviteeName: null as string | null,
        inviteeEmail: row.email,
        expiresAt: row.expiresAt,
        projectId: row.projectId,
        teamId: row.teamId,
      })),
      ...replies.map((row) => ({
        id: row.id,
        type: (row.acceptedAt ? 'accepted' : 'declined') as
          | 'accepted'
          | 'declined',
        kind: row.kind,
        role: row.role,
        workspaceName: row.project?.name ?? row.team?.name ?? '',
        inviterName: row.invitedBy.name,
        inviterEmail: row.invitedBy.email,
        inviteeName: names.get(row.email) ?? null,
        inviteeEmail: row.email,
        expiresAt: row.expiresAt,
        projectId: row.projectId,
        teamId: row.teamId,
      })),
    ]
  }

  accept = async (user: AuthUser, token: string) => {
    const invite = await this.findByToken(token)
    this.assertCanRespond(invite)
    if (invite.email !== user.email.toLowerCase()) {
      throw new ForbiddenException(
        '초대받은 계정으로 로그인한 뒤 수락해 주세요.',
      )
    }
    await this.apply(invite, user)
    return {
      ok: true,
      kind: invite.kind,
      teamId: invite.teamId,
      projectId: invite.projectId,
    }
  }

  acceptReceived = async (user: AuthUser, id: string) => {
    const invite = await this.requireReceived(user, id)
    this.assertCanRespond(invite)
    await this.apply(invite, user)
    return {
      ok: true,
      kind: invite.kind,
      teamId: invite.teamId,
      projectId: invite.projectId,
    }
  }

  decline = async (token: string) => {
    const invite = await this.findByToken(token)
    return this.markDeclined(invite)
  }

  declineReceived = async (user: AuthUser, id: string) => {
    const invite = await this.requireReceived(user, id)
    return this.markDeclined(invite)
  }

  resend = async (inviteId: string, actor: AuthUser) => {
    const invite = await this.prisma.invitation.findUnique({
      where: { id: inviteId },
      include: inviteInclude,
    })
    if (!invite || invite.acceptedAt) {
      throw new NotFoundException('대기 중인 초대가 없어요.')
    }
    const expiresAt = expiresInDays(INVITE_DAYS)
    const rawToken = newToken()
    const updated = await this.prisma.invitation.update({
      where: { id: invite.id },
      data: {
        expiresAt,
        token: hashSecret(rawToken),
        invitedById: actor.id,
        declinedAt: null,
        inviterReadAt: null,
      },
      include: inviteInclude,
    })
    const mailed = await this.mail.sendInvite({
      to: updated.email,
      inviterName: actor.name,
      workspaceName: updated.team?.name ?? updated.project?.name ?? '',
      roleLabel: roleLabel(updated.role),
      url: this.inviteUrl(rawToken),
      expiresAt: updated.expiresAt,
    })
    await this.notify.publishInvite(updated.email)
    return { invitation: this.toClient(updated, rawToken), mailed }
  }

  revoke = async (inviteId: string) => {
    const invite = await this.prisma.invitation.findUnique({
      where: { id: inviteId },
    })
    if (!invite || invite.acceptedAt) {
      throw new NotFoundException('대기 중인 초대가 없어요.')
    }
    await this.prisma.invitation.delete({ where: { id: inviteId } })
    return { ok: true }
  }

  private findByToken = async (token: string) => {
    for (const value of secretLookupValues(token)) {
      const invite = await this.prisma.invitation.findUnique({
        where: { token: value },
        include: inviteInclude,
      })
      if (invite) return invite
    }
    throw new NotFoundException('초대를 찾을 수 없어요.')
  }

  private requireReceived = async (user: AuthUser, id: string) => {
    const invite = await this.prisma.invitation.findFirst({
      where: { id, email: user.email.toLowerCase() },
      include: inviteInclude,
    })
    if (!invite) throw new NotFoundException('초대를 찾을 수 없어요.')
    return invite
  }

  private assertCanRespond = (invite: Invitation) => {
    const status = inviteStatus(invite)
    if (status === 'expired') {
      throw new BadRequestException('초대가 만료됐어요. 다시 초대해 주세요.')
    }
    if (status === 'declined') {
      throw new BadRequestException('이미 거절한 초대예요.')
    }
  }

  dismissDeclined = async (user: AuthUser, id: string) => {
    const invite = await this.prisma.invitation.findFirst({
      where: {
        id,
        invitedById: user.id,
        inviterReadAt: null,
        OR: [
          { declinedAt: { not: null } },
          { acceptedAt: { not: null } },
        ],
      },
    })
    if (!invite) throw new NotFoundException('초대를 찾을 수 없어요.')
    await this.prisma.invitation.update({
      where: { id: invite.id },
      data: { inviterReadAt: new Date() },
    })
    return { ok: true as const }
  }

  private markDeclined = async (invite: Invitation) => {
    this.assertCanRespond(invite)
    if (invite.acceptedAt) {
      throw new BadRequestException('이미 수락한 초대예요.')
    }
    if (invite.declinedAt) return { ok: true as const }
    const updated = await this.prisma.invitation.update({
      where: { id: invite.id },
      data: { declinedAt: new Date(), token: hashSecret(newToken()) },
      include: inviteInclude,
    })
    await this.notify.publishInviteDeclined(updated.invitedBy.email)
    return { ok: true as const }
  }

  private apply = async (invite: Invitation, user: AuthUser) => {
    if (invite.acceptedAt) return
    let joinedTeamId: string | null = invite.kind === 'team' ? invite.teamId : null
    if (invite.kind === 'team' && invite.teamId) {
      await this.prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: invite.teamId, userId: user.id } },
        update: { role: invite.role },
        create: { teamId: invite.teamId, userId: user.id, role: invite.role },
      })
    } else if (invite.kind === 'project' && invite.projectId) {
      const project = await this.prisma.project.findUnique({
        where: { id: invite.projectId },
        select: { teamId: true, ownerId: true },
      })
      joinedTeamId = project?.teamId ?? null
      await this.prisma.projectMember.upsert({
        where: {
          projectId_userId: { projectId: invite.projectId, userId: user.id },
        },
        update: { role: invite.role },
        create: {
          projectId: invite.projectId,
          userId: user.id,
          role: invite.role,
        },
      })
      if (project?.teamId) {
        await this.prisma.teamMember.upsert({
          where: {
            teamId_userId: { teamId: project.teamId, userId: user.id },
          },
          update: {},
          create: {
            teamId: project.teamId,
            userId: user.id,
            role: invite.role,
          },
        })
      }
    }
    await this.prisma.invitation.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date(), token: hashSecret(newToken()) },
    })
    const inviter = await this.prisma.user.findUnique({
      where: { id: invite.invitedById },
      select: { email: true },
    })
    if (inviter) await this.notify.publishInviteAccepted(inviter.email)
    if (invite.kind === 'team' && joinedTeamId) {
      await this.notify.publishTeamChange(joinedTeamId, user.id)
    } else if (invite.kind === 'project' && joinedTeamId && invite.projectId) {
      await this.notify.publishProjectChange(joinedTeamId, user.id, invite.projectId)
    }
  }

  rotatePlaintextInvites = async () => {
    const rows = await this.prisma.invitation.findMany({
      include: inviteInclude,
    })
    let rotated = 0
    for (const invite of rows) {
      if (looksLikeSha256Hex(invite.token)) continue
      if (invite.acceptedAt || invite.declinedAt || invite.expiresAt <= new Date()) {
        await this.prisma.invitation.update({
          where: { id: invite.id },
          data: { token: hashSecret(invite.token) },
        })
        continue
      }
      const rawToken = newToken()
      const updated = await this.prisma.invitation.update({
        where: { id: invite.id },
        data: { token: hashSecret(rawToken) },
        include: inviteInclude,
      })
      await this.mail.sendInvite({
        to: updated.email,
        inviterName: updated.invitedBy.name,
        workspaceName: updated.team?.name ?? updated.project?.name ?? '',
        roleLabel: roleLabel(updated.role),
        url: this.inviteUrl(rawToken),
        expiresAt: updated.expiresAt,
      })
      rotated += 1
    }
    if (rotated) {
      this.logger.log(`Rotated ${rotated} plaintext invite token(s)`)
    }
  }
}

const inviteInclude = {
  team: { select: { name: true } },
  project: { select: { name: true } },
  invitedBy: { select: userSelect },
} as const

const pendingWhere = (scope: { teamId?: string; projectId?: string }) => ({
  acceptedAt: null,
  declinedAt: null,
  expiresAt: { gt: new Date() },
  ...scope,
})

const newToken = () => randomBytes(32).toString('base64url')

const expiresInDays = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

const roleLabel = (role: string) => (role === 'viewer' ? '보기' : '편집')

