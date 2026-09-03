import { createHash, randomBytes } from 'node:crypto'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisService } from './redis.service'
import { durationSeconds } from '../common/duration'

type RefreshRecord = { userId: string; family: string; hash: string }

@Injectable()
export class RefreshTokenService {
  constructor(
    private redis: RedisService,
    private config: ConfigService,
  ) {}

  ttlSeconds = () =>
    durationSeconds(this.config.get<string>('JWT_REFRESH_EXPIRES'), 14 * 86400)

  issue = async (userId: string, family = newId()) => {
    const id = newId()
    const secret = randomBytes(32).toString('base64url')
    const ttl = this.ttlSeconds()
    const record: RefreshRecord = {
      userId,
      family,
      hash: sha256(secret),
    }
    const pipe = this.redis.client.pipeline()
    pipe.set(refreshKey(id), JSON.stringify(record), 'EX', ttl)
    pipe.sadd(familyKey(family), id)
    pipe.expire(familyKey(family), ttl)
    pipe.sadd(userFamiliesKey(userId), family)
    pipe.expire(userFamiliesKey(userId), ttl)
    await pipe.exec()
    return { refreshToken: `${id}.${secret}`, family }
  }

  rotate = async (raw: string) => {
    const parsed = parseToken(raw)
    if (!parsed) throw unauthorized()
    const previous = await this.redis.client.getdel(refreshKey(parsed.id))
    if (!previous) {
      const family = await this.redis.client.get(usedKey(parsed.id))
      if (family) await this.revokeFamily(family)
      throw unauthorized()
    }
    const record = JSON.parse(previous) as RefreshRecord
    if (record.hash !== sha256(parsed.secret)) {
      await this.revokeFamily(record.family)
      throw unauthorized()
    }
    const ttl = this.ttlSeconds()
    await this.redis.client
      .pipeline()
      .set(usedKey(parsed.id), record.family, 'EX', ttl)
      .srem(familyKey(record.family), parsed.id)
      .exec()
    const next = await this.issue(record.userId, record.family)
    return { userId: record.userId, refreshToken: next.refreshToken }
  }

  revoke = async (raw: string) => {
    const parsed = parseToken(raw)
    if (!parsed) return
    const previous = await this.redis.client.getdel(refreshKey(parsed.id))
    if (!previous) return
    const record = JSON.parse(previous) as RefreshRecord
    await this.revokeFamily(record.family)
  }

  revokeAllForUser = async (userId: string) => {
    const families = await this.redis.client.smembers(userFamiliesKey(userId))
    await Promise.all(families.map((family) => this.revokeFamily(family)))
    await this.redis.client.del(userFamiliesKey(userId))
  }

  private revokeFamily = async (family: string) => {
    const ids = await this.redis.client.smembers(familyKey(family))
    let userId: string | undefined
    const pipe = this.redis.client.pipeline()
    for (const id of ids) {
      const raw = await this.redis.client.get(refreshKey(id))
      if (raw && !userId) {
        userId = (JSON.parse(raw) as RefreshRecord).userId
      }
      pipe.del(refreshKey(id))
      pipe.del(usedKey(id))
    }
    pipe.del(familyKey(family))
    if (userId) pipe.srem(userFamiliesKey(userId), family)
    await pipe.exec()
  }
}

const newId = () => randomBytes(16).toString('base64url')

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex')

const refreshKey = (id: string) => `auth:refresh:${id}`
const familyKey = (family: string) => `auth:family:${family}`
const usedKey = (id: string) => `auth:used:${id}`
const userFamiliesKey = (userId: string) => `auth:user-families:${userId}`

const parseToken = (raw: string) => {
  const sep = raw.indexOf('.')
  if (sep <= 0 || sep === raw.length - 1) return null
  return { id: raw.slice(0, sep), secret: raw.slice(sep + 1) }
}

const unauthorized = () =>
  new UnauthorizedException('다시 로그인해 주세요.')
