import { Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { RedisService } from './redis.service'
import type { JwtPayload } from '../common/auth/jwt-payload'

@Injectable()
export class AccessTokenService {
  constructor(
    private redis: RedisService,
    private jwt: JwtService,
  ) {}

  deny = async (jti: string, ttlSeconds: number) => {
    if (!jti || ttlSeconds <= 0) return
    await this.redis.client.set(denyKey(jti), '1', 'EX', ttlSeconds)
  }

  isDenied = async (jti: string | undefined) => {
    if (!jti) return false
    return Boolean(await this.redis.client.get(denyKey(jti)))
  }

  denyToken = async (token: string | undefined) => {
    if (!token) return
    try {
      const payload = this.jwt.verify(token) as JwtPayload
      const ttl = (payload.exp ?? 0) - Math.floor(Date.now() / 1000)
      await this.deny(payload.jti ?? '', ttl)
    } catch {
      /* expired or malformed */
    }
  }
}

const denyKey = (jti: string) => `auth:deny:${jti}`
