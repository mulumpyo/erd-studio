import { createHash } from 'node:crypto'

export const looksLikeSha256Hex = (value: string) => /^[a-f0-9]{64}$/.test(value)

export const hashSecret = (value: string) =>
  createHash('sha256').update(value).digest('hex')

/** Lookup stored hash first, then legacy plaintext. A leaked hash cannot be replayed. */
export const secretLookupValues = (presented: string) => {
  const hashed = hashSecret(presented)
  if (looksLikeSha256Hex(presented)) return [hashed]
  return hashed === presented ? [presented] : [hashed, presented]
}
