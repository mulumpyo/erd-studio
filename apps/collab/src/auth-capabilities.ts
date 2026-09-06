export type AuthCapabilities = {
  userId: string | null
  projectId: string
  canView: boolean
  canEdit: boolean
  token: string
}

export type AuthContext = {
  token?: string
  auth?: AuthCapabilities | null
  user?: { id?: string }
}

export const buildAuthCapabilities = (input: {
  projectId: string
  token: string
  userId: string | null
  canEdit: boolean
}): AuthCapabilities => ({
  userId: input.userId,
  projectId: input.projectId,
  canView: true,
  canEdit: input.canEdit,
  token: input.token,
})

/** Apply cached capabilities to the live connection (no Prisma). */
export const applyCachedAuth = (
  connection: { readOnly: unknown },
  context: AuthContext,
): AuthCapabilities => {
  const caps = context.auth
  if (!caps || !caps.canView) {
    throw new Error('forbidden')
  }
  connection.readOnly = !caps.canEdit
  return caps
}

export const invalidateAuth = (context: AuthContext | undefined) => {
  if (context) context.auth = null
}

export type KickPayload = { projectId?: string; userId?: string }

type KickConnection = {
  readOnly: unknown
  context?: AuthContext
  close?: (event?: { code: number; reason: string }) => void
}

export const dropConnection = (connection: unknown) => {
  const conn = connection as KickConnection
  invalidateAuth(conn.context)
  conn.readOnly = true
  conn.close?.({ code: 4403, reason: 'forbidden' })
}

/**
 * Drop matching connections and clear their auth cache.
 * Called on kick / ACL change pubsub messages.
 */
export const applyKick = (
  documents: Map<string, unknown> | undefined,
  payload: KickPayload,
  drop: (connection: unknown) => void = dropConnection,
) => {
  if (!documents) return 0
  let dropped = 0
  for (const [name, doc] of documents) {
    if (payload.projectId && name !== payload.projectId) continue
    const connections = (
      doc as { connections?: Map<unknown, KickConnection> }
    ).connections
    if (!connections) continue
    for (const [, connection] of connections) {
      const id =
        connection.context?.user?.id ?? connection.context?.auth?.userId ?? null
      if (payload.userId && id !== payload.userId) continue
      drop(connection)
      dropped += 1
    }
  }
  return dropped
}
