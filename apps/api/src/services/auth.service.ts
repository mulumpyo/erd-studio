import { randomBytes, randomUUID } from 'node:crypto'
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from './prisma.service'
import { InvitationsService } from './invitations.service'
import { MailService } from './mail.service'
import { RefreshTokenService } from './refresh-token.service'
import { AccessTokenService } from './access-token.service'
import { CollabAclService } from './collab-acl.service'
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
} from '../common/auth/dto'
import type { AuthUser } from '../common/auth/current-user'
import { accessExpiresSeconds } from '../common/auth/cookies'
import { safeInternalPath, webOrigin } from '../common/urls'
import { allowDevMagicLinks } from '../config/secrets'
import { hashSecret, looksLikeSha256Hex, secretLookupValues } from '../common/token-hash'

const VERIFY_HOURS = 24
const RESET_HOURS = 2
const RESEND_COOLDOWN_MS = 60_000

export type SessionResult = {
  token: string
  refreshToken: string
  user: AuthUser
  expiresAt: number
  nextPath?: string
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private invitations: InvitationsService,
    private mail: MailService,
    private refreshTokens: RefreshTokenService,
    private accessTokens: AccessTokenService,
    private collabAcl: CollabAclService,
  ) {}

  onModuleInit = () => this.hashLegacyEmailTokens()

  register = async (dto: RegisterDto) => {
    const email = dto.email.toLowerCase()
    const nextPath = safeInternalPath(dto.nextPath)
    const exists = await this.prisma.user.findUnique({ where: { email } })
    if (exists?.emailVerifiedAt) {
      return {
        needsVerification: true as const,
        email,
        mailed: true,
      }
    }
    const passwordHash = await bcrypt.hash(dto.password, 10)
    const user = exists
      ? await this.prisma.user.update({
          where: { id: exists.id },
          data: { name: dto.name, passwordHash },
        })
      : await this.prisma.user.create({
          data: { email, name: dto.name, passwordHash },
        })
    return this.sendVerification(user.id, user.email, user.name, nextPath)
  }

  login = async (dto: LoginDto) => {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    })
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException(
        '이메일 또는 비밀번호가 올바르지 않습니다.',
      )
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('이메일 인증이 필요해요')
    }
    const session = await this.issueSession(user.id, user.email, user.name)
    await this.invitations.acceptPendingForUser(session.user)
    return session
  }

  verifyEmail = async (token: string) => {
    let row = null
    for (const value of secretLookupValues(token)) {
      row = await this.prisma.emailVerification.findUnique({
        where: { token: value },
        include: { user: true },
      })
      if (row) break
    }
    if (!row || row.expiresAt <= new Date()) {
      throw new NotFoundException('인증 링크가 만료됐거나 올바르지 않아요')
    }
    const { user, nextPath } = row
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
      }),
      this.prisma.emailVerification.deleteMany({ where: { userId: user.id } }),
    ])
    const session = await this.issueSession(
      user.id,
      user.email,
      user.name,
      nextPath,
    )
    await this.invitations.acceptPendingForUser(session.user)
    return session
  }

  resendVerification = async (email: string) => {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })
    if (!user || user.emailVerifiedAt) return { ok: true as const }
    const latest = await this.prisma.emailVerification.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    await this.sendVerification(
      user.id,
      user.email,
      user.name,
      latest?.nextPath,
    )
    return { ok: true as const }
  }

  refresh = async (refreshToken: string | undefined) => {
    if (!refreshToken) throw new UnauthorizedException('다시 로그인해 주세요.')
    const rotated = await this.refreshTokens.rotate(refreshToken)
    const user = await this.prisma.user.findUnique({
      where: { id: rotated.userId },
    })
    if (!user?.emailVerifiedAt) {
      await this.refreshTokens.revoke(rotated.refreshToken)
      throw new UnauthorizedException('다시 로그인해 주세요.')
    }
    return this.issueAccess(user.id, user.email, user.name, rotated.refreshToken)
  }

  logout = async (accessToken?: string, refreshToken?: string) => {
    await this.accessTokens.denyToken(accessToken)
    if (refreshToken) await this.refreshTokens.revoke(refreshToken)
    return { ok: true as const }
  }

  forgotPassword = async (email: string) => {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })
    if (!user?.emailVerifiedAt) return { ok: true as const }
    const latest = await this.prisma.passwordReset.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      return { ok: true as const }
    }
    await this.prisma.passwordReset.deleteMany({ where: { userId: user.id } })
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + RESET_HOURS * 60 * 60 * 1000)
    await this.prisma.passwordReset.create({
      data: { token: hashSecret(token), userId: user.id, expiresAt },
    })
    const url = `${webOrigin()}/reset/${token}`
    const mailed = await this.mail.sendReset({
      to: user.email,
      name: user.name,
      url,
      expiresAt,
    })
    return {
      ok: true as const,
      resetUrl: mailed || !allowDevMagicLinks() ? undefined : url,
    }
  }

  resetPassword = async (token: string, password: string) => {
    let row = null
    for (const value of secretLookupValues(token)) {
      row = await this.prisma.passwordReset.findUnique({
        where: { token: value },
        include: { user: true },
      })
      if (row) break
    }
    if (!row || row.expiresAt <= new Date()) {
      throw new NotFoundException('재설정 링크가 만료됐거나 올바르지 않아요')
    }
    await this.replacePassword(row.user.id, password)
    await this.prisma.passwordReset.deleteMany({ where: { userId: row.user.id } })
    return { ok: true as const }
  }

  changePassword = async (user: AuthUser, dto: ChangePasswordDto) => {
    const row = await this.prisma.user.findUnique({ where: { id: user.id } })
    if (!row || !(await bcrypt.compare(dto.currentPassword, row.passwordHash))) {
      throw new UnauthorizedException('현재 비밀번호가 올바르지 않습니다.')
    }
    await this.replacePassword(user.id, dto.newPassword)
    return { ok: true as const }
  }

  collabToken = (user: AuthUser) => ({
    token: this.jwt.sign(
      { sub: user.id, email: user.email, typ: 'collab' },
      { expiresIn: '2m', jwtid: randomUUID() },
    ),
  })

  private replacePassword = async (userId: string, password: string) => {
    const passwordHash = await bcrypt.hash(password, 10)
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, tokenRevokedAt: new Date() },
    })
    await this.refreshTokens.revokeAllForUser(userId)
    await this.collabAcl.kickUser(userId)
  }

  private sendVerification = async (
    userId: string,
    email: string,
    name: string,
    nextPath: string | null | undefined,
  ) => {
    const latest = await this.prisma.emailVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      throw new BadRequestException('잠시 후 다시 보내 주세요.')
    }
    await this.prisma.emailVerification.deleteMany({ where: { userId } })
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + VERIFY_HOURS * 60 * 60 * 1000)
    await this.prisma.emailVerification.create({
      data: {
        token: hashSecret(token),
        userId,
        nextPath: nextPath ?? null,
        expiresAt,
      },
    })
    const url = `${webOrigin()}/verify/${token}`
    const mailed = await this.mail.sendVerify({
      to: email,
      name,
      url,
      expiresAt,
    })
    return {
      needsVerification: true as const,
      email,
      mailed,
      verifyUrl: mailed || !allowDevMagicLinks() ? undefined : url,
    }
  }

  private issueSession = async (
    id: string,
    email: string,
    name: string,
    nextPath?: string | null,
  ): Promise<SessionResult> => {
    const { refreshToken } = await this.refreshTokens.issue(id)
    return {
      ...this.issueAccess(id, email, name, refreshToken),
      nextPath: nextPath || undefined,
    }
  }

  private issueAccess = (
    id: string,
    email: string,
    name: string,
    refreshToken: string,
  ): SessionResult => ({
    token: this.jwt.sign(
      { sub: id, email, typ: 'access' },
      { jwtid: randomUUID() },
    ),
    refreshToken,
    user: { id, email, name },
    expiresAt: Date.now() + accessExpiresSeconds() * 1000,
  })

  private hashLegacyEmailTokens = async () => {
    const rows = await this.prisma.emailVerification.findMany()
    for (const row of rows) {
      if (looksLikeSha256Hex(row.token)) continue
      await this.prisma.emailVerification.update({
        where: { id: row.id },
        data: { token: hashSecret(row.token) },
      })
    }
  }
}
