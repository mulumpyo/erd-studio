import type { ThrottlerStorage } from '@nestjs/throttler'
import type Redis from 'ioredis'
import type { RedisService } from '../services/redis.service'

type ThrottlerHit = {
  totalHits: number
  timeToExpire: number
  isBlocked: boolean
  timeToBlockExpire: number
}

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private redis: Redis) {}

  increment = async (
    key: string,
    ttl: number,
    limit = Number.MAX_SAFE_INTEGER,
    _blockDuration?: number,
    _throttlerName?: string,
  ): Promise<ThrottlerHit> => {
    const hits = await this.redis.incr(key)
    if (hits === 1) await this.redis.pexpire(key, Math.max(1, ttl))
    const pttl = await this.redis.pttl(key)
    const blocked = hits > limit
    return {
      totalHits: hits,
      timeToExpire: Math.max(0, pttl),
      isBlocked: blocked,
      timeToBlockExpire: blocked ? Math.max(0, pttl) : 0,
    }
  }
}

export const redisThrottlerStorage = (redis: RedisService) =>
  new RedisThrottlerStorage(redis.client)
