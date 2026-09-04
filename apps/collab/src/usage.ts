import {
  REDIS_USAGE_TTL_SECONDS,
  redisUsageDayKey,
  redisUsageHitKey,
  usageDayKey,
} from '@erd-studio/shared'
import type Redis from 'ioredis'
import type { PrismaClient } from '@prisma/client'

const isGuestId = (userId: string) => userId.startsWith('guest:')

export const touchUsage = async (
  redis: Redis,
  prisma: PrismaClient,
  userId: string,
) => {
  if (!userId || isGuestId(userId)) return
  const day = usageDayKey()
  try {
    const created = await redis.set(
      redisUsageHitKey(day, userId),
      '1',
      'EX',
      REDIS_USAGE_TTL_SECONDS,
      'NX',
    )
    if (created !== 'OK') return
    await redis.sadd(redisUsageDayKey(day), userId)
    await redis.expire(redisUsageDayKey(day), REDIS_USAGE_TTL_SECONDS)
  } catch {
    /* Redis가 잠깐 죽어도 DB에는 남겨요. */
  }
  try {
    await prisma.userActivityDay.upsert({
      where: { day_userId: { day, userId } },
      create: { day, userId },
      update: {},
    })
  } catch {
    /* 없는 계정이면 건너뛰어요. */
  }
}
