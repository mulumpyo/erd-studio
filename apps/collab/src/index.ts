import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import Redis from 'ioredis'
import { Server } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import * as Y from 'yjs'
import {
  canEditProject,
  canViewProject,
  type ErdDocument,
} from '@erd-studio/shared'
import { isDocEmpty, seedIfEmpty, yToErd } from '@erd-studio/yjs-erd'
import { requireJwtSecret } from './secrets'
import { isAllowedCollabOrigin } from './origin'
import { accessTokenFromCookie } from './cookies'

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
)
dotenv.config({ path: path.join(root, '.env') })

const prisma = new PrismaClient()
const secret = requireJwtSecret()
const port = Number(process.env.COLLAB_PORT ?? 3030)
const jwtOpts = { algorithms: ['HS256'] as jwt.Algorithm[] }
const COLLAB_KICK_CHANNEL = 'erd:collab:kick'

type JwtPayload = {
  sub: string
  email: string
  typ?: string
  jti?: string
  iat?: number
}

type KickPayload = { projectId?: string; userId?: string }

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

const hasVerifiedEmail = <T extends object>(
  user: T | null | undefined,
): user is T & { emailVerifiedAt: Date; tokenRevokedAt?: Date | null } =>
  Boolean(
    user &&
      'emailVerifiedAt' in user &&
      (user as { emailVerifiedAt?: Date | null }).emailVerifiedAt,
  )

const dropConnection = (connection: unknown) => {
  const conn = connection as {
    readOnly: unknown
    close?: (event?: { code: number; reason: string }) => void
  }
  conn.readOnly = true
  conn.close?.({ code: 4403, reason: 'forbidden' })
}

const verifyAccessJwt = async (token: string) => {
  const payload = jwt.verify(token, secret, jwtOpts) as JwtPayload
  if (payload.typ && payload.typ !== 'access' && payload.typ !== 'collab') {
    throw new Error('unauthorized')
  }
  if (payload.jti) {
    try {
      if (await redis.get(`auth:deny:${payload.jti}`)) {
        throw new Error('unauthorized')
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'unauthorized') throw error
    }
  }
  return payload
}

const authorize = async (
  token: string | undefined,
  projectId: string,
  write: boolean,
) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { team: { include: { members: true } }, members: true },
  })
  if (!project) throw new Error('not found')
  if (!token || token === 'public-read') {
    if (!write && project.isPublic) return { user: null }
    throw new Error('unauthorized')
  }
  const payload = await verifyAccessJwt(token)
  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!hasVerifiedEmail(user)) throw new Error('unauthorized')
  const revokedSec = user.tokenRevokedAt
    ? Math.floor(user.tokenRevokedAt.getTime() / 1000)
    : 0
  if (payload.iat && revokedSec && payload.iat < revokedSec) {
    throw new Error('unauthorized')
  }
  if (write) {
    if (canEditProject(user, project)) return { user }
    throw new Error(canViewProject(user, project) ? 'readonly' : 'forbidden')
  }
  if (canViewProject(user, project)) return { user }
  throw new Error('forbidden')
}

const canSee = async (token: string | undefined, projectId: string) => {
  try {
    await authorize(token, projectId, false)
    return true
  } catch {
    return false
  }
}

const canWrite = async (token: string | undefined, projectId: string) => {
  if (!token || token === 'public-read') return false
  try {
    await authorize(token, projectId, true)
    return true
  } catch {
    return false
  }
}

const presentedToken = (
  protocolToken: string | undefined,
  cookieHeader?: string,
) => accessTokenFromCookie(cookieHeader) || protocolToken

const server = Server.configure({
  port,
  async onAuthenticate({ token, documentName, connection, request }) {
    const origin = request?.headers?.origin
    if (!isAllowedCollabOrigin(typeof origin === 'string' ? origin : undefined)) {
      dropConnection(connection)
      throw new Error('forbidden')
    }
    const cookieHeader =
      typeof request?.headers?.cookie === 'string'
        ? request.headers.cookie
        : undefined
    const presented = presentedToken(token, cookieHeader)
    try {
      const { user } = await authorize(presented, documentName, true)
      if (!user) throw new Error('readonly')
      return {
        user: { id: user.id, name: user.name, email: user.email },
        token: presented,
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'forbidden') {
        dropConnection(connection)
        throw error
      }
      try {
        const { user } = await authorize(presented, documentName, false)
        connection.readOnly = true
        if (!user) {
          return {
            user: { id: `guest:${randomUUID()}`, name: '방문자' },
            token: presented || '',
          }
        }
        return {
          user: { id: user.id, name: user.name, email: user.email },
          token: presented,
        }
      } catch {
        dropConnection(connection)
        throw new Error('forbidden')
      }
    }
  },
  async beforeHandleMessage({ context, documentName, connection }) {
    const token = (context as { token?: string }).token
    if (!(await canSee(token, documentName))) {
      dropConnection(connection)
      throw new Error('forbidden')
    }
    const writable = await canWrite(token, documentName)
    connection.readOnly = !writable
  },
  async onLoadDocument({ document, documentName }) {
    if (!isDocEmpty(document)) return document
    const project = await prisma.project.findUnique({
      where: { id: documentName },
    })
    const snapshot = project?.snapshot as ErdDocument | null
    if (snapshot) seedIfEmpty(document, snapshot)
    return document
  },
  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const project = await prisma.project.findUnique({
          where: { id: documentName },
        })
        if (project?.yjsState) return new Uint8Array(project.yjsState)
        return null
      },
      store: async ({ documentName, state }) => {
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, state)
        await prisma.project.update({
          where: { id: documentName },
          data: {
            yjsState: Buffer.from(state),
            snapshot: yToErd(ydoc) as object,
          },
        })
      },
    }),
  ],
})

const documentsOf = (instance: unknown) => {
  const root = instance as {
    documents?: Map<string, unknown>
    hocuspocus?: { documents?: Map<string, unknown> }
  }
  return root.documents || root.hocuspocus?.documents
}

const applyKick = (payload: KickPayload) => {
  const documents = documentsOf(server)
  if (!documents) return
  for (const [name, doc] of documents) {
    if (payload.projectId && name !== payload.projectId) continue
    const connections = (
      doc as {
        connections?: Map<
          unknown,
          { context?: { user?: { id?: string } } }
        >
      }
    ).connections
    if (!connections) continue
    for (const [, connection] of connections) {
      const id = connection.context?.user?.id
      if (payload.userId && id !== payload.userId) continue
      dropConnection(connection)
    }
  }
}

const listenForKicks = async () => {
  try {
    await redis.connect()
    const sub = redis.duplicate()
    await sub.subscribe(COLLAB_KICK_CHANNEL)
    sub.on('message', (_channel, message) => {
      try {
        applyKick(JSON.parse(message) as KickPayload)
      } catch {
        /* ignore malformed */
      }
    })
  } catch (error) {
    console.warn(
      '[collab] Redis kick channel unavailable',
      error instanceof Error ? error.message : '',
    )
  }
}

server.listen().then(() => {
  console.log(`Collab listening on ws://localhost:${port}`)
  void listenForKicks()
})
