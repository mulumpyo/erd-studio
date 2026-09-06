export type DenyListRedis = {
  get: (key: string) => Promise<string | null>
}

const denyKey = (jti: string) => `auth:deny:${jti}`

/**
 * Fail-closed JWT deny-list check.
 * Redis errors reject the token (do not allow write as if not denied).
 */
export const assertJwtNotDenied = async (
  redis: DenyListRedis,
  jti: string | undefined,
): Promise<void> => {
  if (!jti) return
  let denied: string | null
  try {
    denied = await redis.get(denyKey(jti))
  } catch (error) {
    console.error(
      '[collab] JWT deny-list Redis failure (fail-closed)',
      error instanceof Error ? error.message : error,
    )
    throw new Error('unauthorized')
  }
  if (denied) throw new Error('unauthorized')
}
