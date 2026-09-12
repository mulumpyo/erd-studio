import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import RedisClient from 'ioredis'
import { Server } from '@hocuspocus/server'
import { Database } from '@hocuspocus/extension-database'
import { Redis as RedisExtension } from '@hocuspocus/extension-redis'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import {
  canEditProject,
  canViewProject,
  type ErdDocument,
} from '@erd-studio/shared'
import { isDocEmpty, seedIfEmpty } from '@erd-studio/yjs-erd'
import { requireJwtSecret } from './secrets'
import { isAllowedCollabOrigin } from './origin'
import { accessTokenFromCookie } from './cookies'
import { touchUsage } from './usage'
import { assertJwtNotDenied } from './deny-list'
import { persistDocumentState } from './persist-document'
import {
  applyCachedAuth,
  applyKick,
  buildAuthCapabilities,
  dropConnection,
  type AuthContext,
  type KickPayload,
} from './auth-capabilities'
import { collabHealthPayload } from './health'

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
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'

type JwtPayload = {
  sub: string
  email: string
  typ?: string
  jti?: string
  iat?: number
}

const redis = new RedisClient(redisUrl, {
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

const verifyAccessJwt = async (token: string) => {
  const payload = jwt.verify(token, secret, jwtOpts) as JwtPayload
  if (payload.typ && payload.typ !== 'access' && payload.typ !== 'collab') {
    throw new Error('unauthorized')
  }
  await assertJwtNotDenied(redis, payload.jti)
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
  if (user.suspendedAt || user.deletedAt) throw new Error('unauthorized')
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

const presentedToken = (
  protocolToken: string | undefined,
  cookieHeader?: string,
) => accessTokenFromCookie(cookieHeader) || protocolToken

const server = Server.configure({
  name: process.env.COLLAB_INSTANCE_NAME || `collab-${randomUUID()}`,
  port,
  async onRequest({ request, response }) {
    const url = request.url?.split('?')[0] ?? ''
    if (url !== '/health' && url !== '/health/') return
    try {
      const body = await collabHealthPayload(redis, prisma)
      response.writeHead(200, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(body))
    } catch {
      response.writeHead(503, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ ok: false }))
    }
    // 기본 "OK" 응답을 막아요 (hocuspocus 관례).
    throw undefined
  },
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
      void touchUsage(redis, prisma, user.id)
      return {
        user: { id: user.id, name: user.name, email: user.email },
        token: presented,
        auth: buildAuthCapabilities({
          projectId: documentName,
          token: presented || '',
          userId: user.id,
          canEdit: true,
        }),
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
            auth: buildAuthCapabilities({
              projectId: documentName,
              token: presented || '',
              userId: null,
              canEdit: false,
            }),
          }
        }
        void touchUsage(redis, prisma, user.id)
        return {
          user: { id: user.id, name: user.name, email: user.email },
          token: presented,
          auth: buildAuthCapabilities({
            projectId: documentName,
            token: presented || '',
            userId: user.id,
            canEdit: false,
          }),
        }
      } catch {
        dropConnection(connection)
        throw new Error('forbidden')
      }
    }
  },
  async beforeHandleMessage({ context, connection }) {
    try {
      applyCachedAuth(connection, context as AuthContext)
    } catch {
      dropConnection(connection)
      throw new Error('forbidden')
    }
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
    new RedisExtension({
      // kick·deny-list와 같은 REDIS_URL로 여러 collab의 Yjs를 맞춰 줘요.
      createClient: () => new RedisClient(redisUrl),
    }),
    new Database({
      fetch: async ({ documentName }) => {
        const project = await prisma.project.findUnique({
          where: { id: documentName },
        })
        if (project?.yjsState) return new Uint8Array(project.yjsState)
        return null
      },
      store: async ({ documentName, state }) => {
        await persistDocumentState(prisma as never, documentName, state)
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

const listenForKicks = async () => {
  try {
    await redis.connect()
    const sub = redis.duplicate()
    await sub.subscribe(COLLAB_KICK_CHANNEL)
    sub.on('message', (_channel, message) => {
      try {
        applyKick(
          documentsOf(server),
          JSON.parse(message) as KickPayload,
        )
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
