import { randomBytes } from 'node:crypto'
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import {
  shiftUsageDay,
  usageDayBounds,
  usageDayKey,
} from '@erd-studio/shared'
import { contains, pageResult, parsePage } from '../common/paging'
import { isBootstrapAdmin } from '../common/admin-env'
import { hashSecret } from '../common/token-hash'
import { webOrigin } from '../common/urls'
import { allowDevMagicLinks } from '../config/secrets'
import { CollabAclService } from './collab-acl.service'
import { MailService } from './mail.service'
import { PrismaService } from './prisma.service'
import { RefreshTokenService } from './refresh-token.service'
import { UsageService } from './usage.service'

const RESET_HOURS = 2
const RESEND_COOLDOWN_MS = 60_000

const publicUser = {
  id: true,
  email: true,
  name: true,
  isAdmin: true,
  emailVerifiedAt: true,
  suspendedAt: true,
  createdAt: true,
} as const

@Injectable()
export class AdminService implements OnModuleInit {
  private readonly log = new Logger(AdminService.name)

  constructor(
    private prisma: PrismaService,
    private usage: UsageService,
    private mail: MailService,
    private refreshTokens: RefreshTokenService,
    private collabAcl: CollabAclService,
  ) {}

  onModuleInit() {
    void this.bootstrap()
  }

  bootstrap = async () => {
    const email = (process.env.INITIAL_ADMIN_EMAIL ?? '').trim().toLowerCase()
    if (!email) return
    const result = await this.prisma.user.updateMany({
      where: { email, isAdmin: false },
      data: { isAdmin: true },
    })
    if (result.count > 0) {
      this.log.log(`초기 관리자로 올렸어요: ${email}`)
    }
  }

  overview = async () => {
    const day = usageDayKey()
    const { start, end } = usageDayBounds(day)
    const lookback = shiftUsageDay(day, -29)
    const [
      total,
      signedUpToday,
      verifiedToday,
      withdrawnToday,
      withdrawnTotal,
      series,
      withdrawnRows,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({
        where: { createdAt: { gte: start, lt: end } },
      }),
      this.prisma.user.count({
        where: { emailVerifiedAt: { gte: start, lt: end } },
      }),
      this.prisma.user.count({
        where: { deletedAt: { gte: start, lt: end } },
      }),
      this.prisma.user.count({
        where: { deletedAt: { not: null } },
      }),
      this.usage.series(lookback, day),
      this.prisma.usageDaily.findMany({
        where: { day: { gte: lookback, lte: day } },
        select: { day: true, withdrawn: true },
      }),
    ])
    const withdrawnByDay = new Map(
      withdrawnRows.map((row) => [row.day, row.withdrawn]),
    )
    const points = series.points.map((point) => ({
      ...point,
      withdrawn: withdrawnByDay.get(point.day) ?? 0,
    }))
    const today = points.at(-1)
    return {
      timezone: 'Asia/Seoul',
      day,
      users: {
        total,
        signedUpToday,
        verifiedToday,
        withdrawnToday,
        withdrawnTotal,
      },
      usage: {
        dau: today?.dau ?? 0,
        wau: today?.wau ?? 0,
        mau: today?.mau ?? 0,
      },
      points,
    }
  }

  listUsers = async (query: {
    q?: string
    page?: number
    limit?: number
    adminsOnly?: boolean
  }) => {
    const { skip, take, page, limit } = parsePage(query.page, query.limit, 20)
    const q = query.q?.trim()
    const where = {
      deletedAt: null,
      isAdmin: Boolean(query.adminsOnly),
      ...(q
        ? {
            OR: [{ email: contains(q) }, { name: contains(q) }],
          }
        : {}),
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: publicUser,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.user.count({ where }),
    ])
    return pageResult(
      items.map((item) => this.withFlags(item)),
      total,
      page,
      limit,
    )
  }

  addAdmin = async (email: string) => {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    })
    if (!user?.emailVerifiedAt || user.deletedAt) {
      throw new NotFoundException('인증된 계정을 찾을 수 없어요.')
    }
    if (user.suspendedAt) {
      throw new BadRequestException('정지된 계정은 관리자로 올릴 수 없어요.')
    }
    if (user.isAdmin) return this.publicById(user.id)
    await this.prisma.user.update({
      where: { id: user.id },
      data: { isAdmin: true },
    })
    return this.publicById(user.id)
  }

  setAdmin = async (id: string, isAdmin: boolean) => {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user || user.deletedAt) throw new NotFoundException('사용자를 찾을 수 없어요.')
    if (user.isAdmin === isAdmin) return this.publicById(id)
    if (!isAdmin) {
      if (isBootstrapAdmin(user.email)) {
        throw new BadRequestException('초기 관리자는 내릴 수 없어요.')
      }
      const admins = await this.prisma.user.count({
        where: { isAdmin: true, deletedAt: null },
      })
      if (admins <= 1) {
        throw new BadRequestException('마지막 관리자는 내릴 수 없어요.')
      }
    }
    if (isAdmin && !user.emailVerifiedAt) {
      throw new BadRequestException('이메일 인증이 끝난 계정만 관리자로 올릴 수 있어요.')
    }
    if (isAdmin && user.suspendedAt) {
      throw new BadRequestException('정지된 계정은 관리자로 올릴 수 없어요.')
    }
    await this.prisma.user.update({
      where: { id },
      data: { isAdmin },
    })
    return this.publicById(id)
  }

  sendPasswordReset = async (id: string) => {
    const user = await this.manageableUser(id)
    if (!user.emailVerifiedAt) {
      throw new BadRequestException('이메일 인증이 끝난 계정만 메일을 보낼 수 있어요.')
    }
    const latest = await this.prisma.passwordReset.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    if (
      latest &&
      Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      throw new BadRequestException('조금 뒤에 다시 보내 주세요.')
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
      mailed,
      resetUrl: mailed || !allowDevMagicLinks() ? undefined : url,
    }
  }

  setSuspended = async (id: string, suspended: boolean) => {
    const user = await this.manageableUser(id)
    if (Boolean(user.suspendedAt) === suspended) return this.publicById(id)
    await this.prisma.user.update({
      where: { id },
      data: suspended
        ? { suspendedAt: new Date(), tokenRevokedAt: new Date() }
        : { suspendedAt: null },
    })
    if (suspended) {
      await this.refreshTokens.revokeAllForUser(id)
      await this.collabAcl.kickUser(id)
    }
    return this.publicById(id)
  }

  private manageableUser = async (id: string) => {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user || user.isAdmin || user.deletedAt) {
      throw new NotFoundException('사용자를 찾을 수 없어요.')
    }
    return user
  }

  private publicById = async (id: string) => {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: publicUser,
    })
    return this.withFlags(user)
  }

  private withFlags = <T extends { email: string }>(user: T) => ({
    ...user,
    locked: isBootstrapAdmin(user.email),
  })
}
