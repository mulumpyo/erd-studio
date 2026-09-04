import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import {
  REDIS_USAGE_TTL_SECONDS,
  computeUsageSeries,
  eachUsageDay,
  isUsageDay,
  redisUsageDayKey,
  redisUsageHitKey,
  shiftUsageDay,
  usageDayKey,
  type ActivityRow,
} from '@erd-studio/shared'
import { PrismaService } from './prisma.service'
import { RedisService } from './redis.service'

const FLUSH_MS = 5 * 60 * 1000

const isGuestId = (userId: string) => userId.startsWith('guest:')

@Injectable()
export class UsageService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(UsageService.name)
  private timer: ReturnType<typeof setInterval> | undefined

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.flushToday()
    }, FLUSH_MS)
    void this.flushToday()
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  touch = async (userId: string, at: Date = new Date()) => {
    if (!userId || isGuestId(userId)) return
    const day = usageDayKey(at)
    let firstToday = true
    try {
      const created = await this.redis.client.set(
        redisUsageHitKey(day, userId),
        '1',
        'EX',
        REDIS_USAGE_TTL_SECONDS,
        'NX',
      )
      firstToday = created === 'OK'
      if (firstToday) {
        await this.redis.client.sadd(redisUsageDayKey(day), userId)
        await this.redis.client.expire(
          redisUsageDayKey(day),
          REDIS_USAGE_TTL_SECONDS,
        )
      }
    } catch (error) {
      this.log.warn(
        `Redis 사용량 기록에 실패해서 DB만 남겨요: ${error instanceof Error ? error.message : error}`,
      )
    }
    if (!firstToday) return
    try {
      await this.persist(day, userId)
    } catch (error) {
      this.log.warn(
        `사용량 DB 기록에 실패했어요: ${error instanceof Error ? error.message : error}`,
      )
    }
  }

  series = async (from: string, to: string) => {
    const start = from <= to ? from : to
    const end = from <= to ? to : from
    if (!isUsageDay(start) || !isUsageDay(end)) {
      throw new BadRequestException('날짜는 YYYY-MM-DD로 보내 주세요.')
    }
    if (eachUsageDay(start, end).length > 366) {
      throw new BadRequestException('한 번에 1년까지만 볼 수 있어요.')
    }
    const lookback = shiftUsageDay(start, -29)
    const rows = await this.activityRows(lookback, end)
    const points = computeUsageSeries(rows, start, end)
    await this.prisma.$transaction(
      points
        .filter((point) => point.day <= usageDayKey())
        .map((point) =>
          this.prisma.usageDaily.upsert({
            where: { day: point.day },
            create: point,
            update: {
              dau: point.dau,
              wau: point.wau,
              mau: point.mau,
            },
          }),
        ),
    )
    return {
      timezone: 'Asia/Seoul',
      from: start,
      to: end,
      points,
    }
  }

  recordWithdrawal = async (at: Date = new Date()) => {
    const day = usageDayKey(at)
    await this.prisma.usageDaily.upsert({
      where: { day },
      create: { day, dau: 0, wau: 0, mau: 0, withdrawn: 1 },
      update: { withdrawn: { increment: 1 } },
    })
  }

  flushToday = async () => {
    const day = usageDayKey()
    try {
      const ids = await this.redis.client.smembers(redisUsageDayKey(day))
      for (const userId of ids) {
        if (isGuestId(userId)) continue
        await this.persist(day, userId)
      }
    } catch (error) {
      this.log.warn(
        `사용량 동기화에 실패했어요: ${error instanceof Error ? error.message : error}`,
      )
    }
  }

  private persist = async (day: string, userId: string) => {
    await this.prisma.userActivityDay.upsert({
      where: { day_userId: { day, userId } },
      create: { day, userId },
      update: {},
    })
    const lookback = shiftUsageDay(day, -29)
    const rows = await this.activityRows(lookback, day)
    const point = computeUsageSeries(rows, day, day)[0]
    if (!point) return
    await this.prisma.usageDaily.upsert({
      where: { day },
      create: point,
      update: {
        dau: point.dau,
        wau: point.wau,
        mau: point.mau,
      },
    })
  }

  /** 원본 기록은 관리자도 남기고, 숫자는 조회할 때 빼요. */
  private activityRows = (
    from: string,
    to: string,
  ): Promise<ActivityRow[]> =>
    this.prisma.userActivityDay.findMany({
      where: {
        day: { gte: from, lte: to },
        user: { isAdmin: false },
      },
      select: { day: true, userId: true },
    })
}
