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

const INVITE_DAYS = 7

export type PendingInvitationDto = {
  id: string
  email: string
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
  ) {}

  onModuleInit = () => this.rotatePlaintextInvites()

  inviteUrl = (token: string) => `${webOrigin()}/invite/${token}`

  toClient = (invite: Invitation, rawToken?: string): PendingInvitationDto => ({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
    ...(rawToken ? { inviteUrl: this.inviteUrl(rawToken) } : {}),
  })

  listPendingForTeam = (teamId: string) =>
    this.prisma.invitation
      .findMany({
        where: pendingWhere({ teamId }),
        orderBy: { createdAt: 'desc' },
      })
      .then((rows) => rows.map((row) => this.toClient(row)))

  listPendingForProject = (projectId: string) =>
    this.prisma.invitation
      .findMany({
        where: pendingWhere({ projectId }),
        orderBy: { createdAt: 'desc' },
      })
      .then((rows) => rows.map((row) => this.toClient(row)))

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
          data: { role: opts.role, token, expiresAt, invitedById: opts.actor.id },
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
      expiresAt: invite.expiresAt,
      status,
      teamId: invite.teamId,
      projectId: invite.projectId,
    }
  }

  accept = async (user: AuthUser, token: string) => {
    const invite = await this.findByToken(token)
    if (inviteStatus(invite) === 'expired') {
      throw new BadRequestException('초대가 만료됐어요. 다시 초대해 주세요.')
    }
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

  acceptPendingForUser = async (user: AuthUser) => {
    const invites = await this.prisma.invitation.findMany({
      where: {
        email: user.email.toLowerCase(),
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    })
    for (const invite of invites) {
      await this.apply(invite, user)
    }
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
      data: { expiresAt, token: hashSecret(rawToken), invitedById: actor.id },
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

  private apply = async (invite: Invitation, user: AuthUser) => {
    if (invite.acceptedAt) return
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
  }

  rotatePlaintextInvites = async () => {
    const rows = await this.prisma.invitation.findMany({
      include: inviteInclude,
    })
    let rotated = 0
    for (const invite of rows) {
      if (looksLikeSha256Hex(invite.token)) continue
      if (invite.acceptedAt || invite.expiresAt <= new Date()) {
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

