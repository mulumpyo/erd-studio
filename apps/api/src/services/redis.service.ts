import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

/** ioredis ping은 `'PONG'` 문자열을 줘요. 헬스 계약은 boolean이에요. */
export const isRedisPingOk = (value: unknown) =>
  value === true || value === 'PONG'

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis

  constructor(config: ConfigService) {
    this.client = new Redis(
      config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
      { maxRetriesPerRequest: 3 },
    )
  }

  ping = async () => isRedisPingOk(await this.client.ping())

  onModuleDestroy = () => this.client.quit()
}
