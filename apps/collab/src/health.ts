import type Redis from 'ioredis'

type PrismaLike = { $queryRaw: (query: TemplateStringsArray) => Promise<unknown> }

/** Redis·DB가 살아 있으면 `{ ok: true }`예요. */
export const collabHealthPayload = async (
  redis: Pick<Redis, 'ping'>,
  prisma: PrismaLike,
) => {
  const pong = await redis.ping()
  if (pong !== 'PONG') throw new Error('redis')
  await prisma.$queryRaw`SELECT 1`
  return { ok: true as const }
}
