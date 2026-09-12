import { createHash } from 'node:crypto'

export const looksLikeSha256Hex = (value: string) => /^[a-f0-9]{64}$/.test(value)

export const hashSecret = (value: string) =>
  createHash('sha256').update(value).digest('hex')

/** 저장된 해시를 먼저 보고, 예전 평문도 받아요. 유출된 해시로는 다시 쓸 수 없어요. */
export const secretLookupValues = (presented: string) => {
  const hashed = hashSecret(presented)
  if (looksLikeSha256Hex(presented)) return [hashed]
  return hashed === presented ? [presented] : [hashed, presented]
}
