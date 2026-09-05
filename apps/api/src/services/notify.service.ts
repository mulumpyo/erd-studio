import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { Request, Response } from 'express'
import type Redis from 'ioredis'
import type { AuthUser } from '../common/auth/current-user'
import { PrismaService } from './prisma.service'
import { RedisService } from './redis.service'

const NOTIFY_CHANNEL = 'erd:notify'
const HEARTBEAT_MS = 25_000
const ACCESS_REFRESH_MS = 5 * 60_000

export type NotifyEvent =
  | {
      type: 'chat'
      projectId: string
      userId: string
      body?: string
      userName?: string
      projectName?: string
      teamName?: string | null
      createdAt?: string
    }
  | { type: 'invite'; email: string }
  | { type: 'invite-declined'; email: string }
  | { type: 'invite-accepted'; email: string }
  | { type: 'team'; teamId: string; userIds: string[]; refreshAccess?: boolean }
  | {
      type: 'project'
      teamId: string
      userIds: string[]
      projectId?: string
      refreshAccess?: boolean
    }

type Socket = {
  userId: string
  email: string
  allowed: Set<string>
  write: (chunk: string) => void
}

const parseNotifyEvent = (raw: string): NotifyEvent | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<NotifyEvent> & {
      projectId?: string
      userId?: string
      email?: string
      teamId?: string
      userIds?: unknown
      body?: string
      userName?: string
      projectName?: string
      teamName?: string | null
      createdAt?: string
    }
    if (
      (parsed.type === 'team' || parsed.type === 'project') &&
      typeof parsed.teamId === 'string' &&
      parsed.teamId &&
      Array.isArray(parsed.userIds) &&
      parsed.userIds.every((id) => typeof id === 'string' && id)
    ) {
      return {
        type: parsed.type,
        teamId: parsed.teamId,
        userIds: parsed.userIds as string[],
        refreshAccess: parsed.refreshAccess === true,
        ...(parsed.type === 'project' &&
        typeof parsed.projectId === 'string' &&
        parsed.projectId
          ? { projectId: parsed.projectId }
          : {}),
      }
    }
    if (
      (parsed.type === 'invite' ||
        parsed.type === 'invite-declined' ||
        parsed.type === 'invite-accepted') &&
      typeof parsed.email === 'string' &&
      parsed.email
    ) {
      return { type: parsed.type, email: parsed.email.toLowerCase() }
    }
    if (
      (parsed.type === 'chat' || !parsed.type) &&
      typeof parsed.projectId === 'string' &&
      parsed.projectId &&
      typeof parsed.userId === 'string' &&
      parsed.userId
    ) {
      return {
        type: 'chat',
        projectId: parsed.projectId,
        userId: parsed.userId,
        body: typeof parsed.body === 'string' ? parsed.body : undefined,
        userName: typeof parsed.userName === 'string' ? parsed.userName : undefined,
        projectName:
          typeof parsed.projectName === 'string' ? parsed.projectName : undefined,
        teamName: typeof parsed.teamName === 'string' ? parsed.teamName : null,
        createdAt:
          typeof parsed.createdAt === 'string' ? parsed.createdAt : undefined,
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

const accessWhere = (userId: string) => ({
  OR: [
    { ownerId: userId },
    { members: { some: { userId } } },
    { team: { members: { some: { userId } } } },
  ],
})

const addIndex = (map: Map<string, Set<Socket>>, key: string, socket: Socket) => {
  let group = map.get(key)
  if (!group) {
    group = new Set()
    map.set(key, group)
  }
  group.add(socket)
}

const dropIndex = (map: Map<string, Set<Socket>>, key: string, socket: Socket) => {
  const group = map.get(key)
  if (!group) return
  group.delete(socket)
  if (!group.size) map.delete(key)
}

@Injectable()
export class NotifyService implements OnModuleInit, OnModuleDestroy {
  private sub: Redis | null = null
  private readonly byUser = new Map<string, Set<Socket>>()
  private readonly byEmail = new Map<string, Set<Socket>>()
  private readonly byProject = new Map<string, Set<Socket>>()

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  onModuleInit = async () => {
    this.sub = this.redis.client.duplicate({ maxRetriesPerRequest: null })
    this.sub.on('error', () => {
      /* reconnect is handled by ioredis */
    })
    this.sub.on('message', (_channel, raw) => {
      const event = parseNotifyEvent(raw)
      if (!event) return
      this.dispatch(event)
    })
    await this.sub.subscribe(NOTIFY_CHANNEL)
  }

  onModuleDestroy = async () => {
    this.byUser.clear()
    this.byEmail.clear()
    this.byProject.clear()
    if (!this.sub) return
    await this.sub.unsubscribe(NOTIFY_CHANNEL)
    await this.sub.quit()
    this.sub = null
  }

  publishChat = async (
    projectId: string,
    userId: string,
    preview?: {
      body: string
      userName: string
      projectName: string
      teamName?: string | null
      createdAt: string
    },
  ) => {
    await this.publish({
      type: 'chat',
      projectId,
      userId,
      ...preview,
    })
  }

  publishInvite = async (email: string) => {
    await this.publish({ type: 'invite', email: email.toLowerCase() })
  }

  publishInviteDeclined = async (email: string) => {
    await this.publish({ type: 'invite-declined', email: email.toLowerCase() })
  }

  publishInviteAccepted = async (email: string) => {
    await this.publish({ type: 'invite-accepted', email: email.toLowerCase() })
  }

  publishTeamChange = (
    teamId: string,
    extraUserId?: string,
    refreshAccess = Boolean(extraUserId),
  ) => this.publishMembership('team', teamId, extraUserId, undefined, refreshAccess)

  publishProjectChange = (
    teamId: string,
    extraUserId?: string,
    projectId?: string,
    refreshAccess = true,
  ) =>
    this.publishMembership('project', teamId, extraUserId, projectId, refreshAccess)

  watch = async (user: AuthUser, req: Request, res: Response) => {
    const email = user.email.toLowerCase()
    req.socket.setTimeout(0)
    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    const write = (chunk: string) => {
      if (res.writableEnded) return
      try {
        res.write(chunk)
        const flush = (res as { flush?: () => void }).flush
        if (typeof flush === 'function') flush.call(res)
      } catch {
        /* closed */
      }
    }
    write(': connected\n\n')

    const socket: Socket = {
      userId: user.id,
      email,
      allowed: new Set(),
      write,
    }
    addIndex(this.byUser, user.id, socket)
    addIndex(this.byEmail, email, socket)
    await this.refreshAllowed(socket)

    const heartbeat = setInterval(() => write(': ping\n\n'), HEARTBEAT_MS)
    const refresh = setInterval(() => {
      void this.refreshAllowed(socket)
    }, ACCESS_REFRESH_MS)

    await new Promise<void>((resolve) => {
      let closed = false
      const done = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        clearInterval(refresh)
        this.dropSocket(socket)
        resolve()
      }
      req.on('close', done)
      res.on('close', done)
    })
  }

  private publishMembership = async (
    type: 'team' | 'project',
    teamId: string,
    extraUserId?: string,
    projectId?: string,
    refreshAccess = false,
  ) => {
    const rows = await this.prisma.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    })
    const userIds = [
      ...new Set(
        [...rows.map((row) => row.userId), extraUserId].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ]
    if (!userIds.length) return
    await this.publish(
      type === 'project'
        ? { type, teamId, userIds, projectId, refreshAccess }
        : { type, teamId, userIds, refreshAccess },
    )
  }

  private dispatch = (event: NotifyEvent) => {
    if (event.type === 'chat') {
      const targets = this.byProject.get(event.projectId)
      if (!targets) return
      const payload = JSON.stringify({
        type: 'chat',
        projectId: event.projectId,
        body: event.body,
        userName: event.userName,
        projectName: event.projectName,
        teamName: event.teamName ?? null,
        createdAt: event.createdAt,
      })
      for (const socket of targets) {
        if (socket.userId === event.userId) continue
        socket.write(`event: notify\ndata: ${payload}\n\n`)
      }
      return
    }
    if (event.type === 'team' || event.type === 'project') {
      const payload = JSON.stringify(
        event.type === 'project'
          ? { type: event.type, teamId: event.teamId, projectId: event.projectId }
          : { type: event.type, teamId: event.teamId },
      )
      for (const userId of event.userIds) {
        const targets = this.byUser.get(userId)
        if (!targets) continue
        for (const socket of targets) {
          socket.write(`event: notify\ndata: ${payload}\n\n`)
          if (event.refreshAccess) void this.refreshAllowed(socket)
        }
      }
      return
    }
    const targets = this.byEmail.get(event.email)
    if (!targets) return
    const payload = JSON.stringify({ type: event.type })
    for (const socket of targets) {
      socket.write(`event: notify\ndata: ${payload}\n\n`)
    }
  }

  private publish = async (event: NotifyEvent) => {
    try {
      await this.redis.client.publish(NOTIFY_CHANNEL, JSON.stringify(event))
    } catch {
      this.dispatch(event)
    }
  }

  private refreshAllowed = async (socket: Socket) => {
    try {
      this.indexProjects(socket, await this.accessibleIds(socket.userId))
    } catch {
      /* keep last known access */
    }
  }

  private indexProjects = (socket: Socket, ids: string[]) => {
    for (const id of socket.allowed) dropIndex(this.byProject, id, socket)
    socket.allowed.clear()
    for (const id of ids) {
      socket.allowed.add(id)
      addIndex(this.byProject, id, socket)
    }
  }

  private dropSocket = (socket: Socket) => {
    dropIndex(this.byUser, socket.userId, socket)
    dropIndex(this.byEmail, socket.email, socket)
    this.indexProjects(socket, [])
  }

  private accessibleIds = async (userId: string) => {
    const rows = await this.prisma.project.findMany({
      where: accessWhere(userId),
      select: { id: true },
    })
    return rows.map((row) => row.id)
  }
}
