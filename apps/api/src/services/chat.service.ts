import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { Request, Response } from 'express'
import type Redis from 'ioredis'
import type { AuthUser } from '../common/auth/current-user'
import { assertEdit, assertParticipant } from '../common/access'
import { ProjectsService } from './projects.service'
import { PrismaService } from './prisma.service'
import { RedisService } from './redis.service'

const chatUserSelect = { id: true, name: true, email: true } as const
const CHAT_INBOX_CHANNEL = 'erd:chat:inbox'
const HEARTBEAT_MS = 25_000
const ACCESS_REFRESH_MS = 60_000

type InboxNotice = { projectId: string; userId: string }

const parseInboxNotice = (raw: string): InboxNotice | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<InboxNotice>
    if (
      typeof parsed.projectId === 'string' &&
      parsed.projectId &&
      typeof parsed.userId === 'string' &&
      parsed.userId
    ) {
      return { projectId: parsed.projectId, userId: parsed.userId }
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

@Injectable()
export class ChatService implements OnModuleInit, OnModuleDestroy {
  private sub: Redis | null = null
  private readonly listeners = new Set<(event: InboxNotice) => void>()

  constructor(
    private projects: ProjectsService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  onModuleInit = async () => {
    this.sub = this.redis.client.duplicate()
    this.sub.on('error', () => {
      /* reconnect is handled by ioredis */
    })
    this.sub.on('message', (_channel, raw) => {
      const event = parseInboxNotice(raw)
      if (!event) return
      for (const listen of this.listeners) listen(event)
    })
    await this.sub.subscribe(CHAT_INBOX_CHANNEL)
  }

  onModuleDestroy = async () => {
    this.listeners.clear()
    if (!this.sub) return
    await this.sub.unsubscribe(CHAT_INBOX_CHANNEL)
    await this.sub.quit()
    this.sub = null
  }

  list = async (user: AuthUser, projectId: string) => {
    const project = await this.projects.requireAccess(user, projectId)
    assertParticipant(user, project)
    return this.prisma.chatMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { user: { select: chatUserSelect } },
    })
  }

  send = async (user: AuthUser, projectId: string, body: string) => {
    const project = await this.projects.requireAccess(user, projectId)
    assertEdit(user, project)
    const last = await this.prisma.chatMessage.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    if (
      last &&
      last.userId === user.id &&
      last.body === body &&
      Date.now() - last.createdAt.getTime() < 4000
    ) {
      return this.prisma.chatMessage.findUniqueOrThrow({
        where: { id: last.id },
        include: { user: { select: chatUserSelect } },
      })
    }
    const created = await this.prisma.chatMessage.create({
      data: { projectId, userId: user.id, body },
      include: { user: { select: chatUserSelect } },
    })
    try {
      await this.redis.client.publish(
        CHAT_INBOX_CHANNEL,
        JSON.stringify({ projectId, userId: user.id }),
      )
    } catch {
      /* inbox stream will catch up on the next load */
    }
    return created
  }

  watchInbox = async (user: AuthUser, req: Request, res: Response) => {
    const allowed = new Set(await this.accessibleIds(user.id))
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
      } catch {
        /* closed */
      }
    }
    write(': connected\n\n')

    const onNotice = (event: InboxNotice) => {
      if (event.userId === user.id) return
      if (!allowed.has(event.projectId)) return
      write(`event: inbox\ndata: ${JSON.stringify({ projectId: event.projectId })}\n\n`)
    }
    this.listeners.add(onNotice)

    const heartbeat = setInterval(() => write(': ping\n\n'), HEARTBEAT_MS)
    const refresh = setInterval(() => {
      void this.accessibleIds(user.id)
        .then((ids) => {
          allowed.clear()
          for (const id of ids) allowed.add(id)
        })
        .catch(() => {
          /* keep last known access */
        })
    }, ACCESS_REFRESH_MS)

    await new Promise<void>((resolve) => {
      const done = () => {
        clearInterval(heartbeat)
        clearInterval(refresh)
        this.listeners.delete(onNotice)
        resolve()
      }
      req.on('close', done)
      res.on('close', done)
    })
  }

  private accessibleIds = async (userId: string) => {
    const rows = await this.prisma.project.findMany({
      where: accessWhere(userId),
      select: { id: true },
    })
    return rows.map((row) => row.id)
  }

  inbox = async (user: AuthUser, lastRead: Record<string, number> = {}) => {
    const access = accessWhere(user.id)
    const rows = await this.prisma.chatMessage.findMany({
      where: { project: access },
      orderBy: { createdAt: 'desc' },
      take: 80,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            team: { select: { id: true, name: true } },
          },
        },
        user: { select: { id: true, name: true } },
      },
    })
    const seen = new Set<string>()
    const items: Array<{
      projectId: string
      projectName: string
      teamName: string | null
      body: string
      userName: string
      userId: string
      createdAt: Date
      unreadCount: number
    }> = []
    for (const row of rows) {
      if (seen.has(row.projectId)) continue
      seen.add(row.projectId)
      items.push({
        projectId: row.project.id,
        projectName: row.project.name,
        teamName: row.project.team?.name ?? null,
        body: row.body,
        userName: row.user.name,
        userId: row.userId,
        createdAt: row.createdAt,
        unreadCount: 0,
      })
      if (items.length >= 20) break
    }
    const ids = items.map((item) => item.projectId)
    if (!ids.length) return items
    const counts = await this.prisma.chatMessage.groupBy({
      by: ['projectId'],
      where: {
        projectId: { in: ids },
        userId: { not: user.id },
        OR: ids.map((id) => ({
          projectId: id,
          createdAt: { gt: new Date(lastRead[id] ?? 0) },
        })),
      },
      _count: { _all: true },
    })
    const unread = new Map(
      counts.map((row) => [row.projectId, row._count._all]),
    )
    for (const item of items) item.unreadCount = unread.get(item.projectId) ?? 0
    return items
  }
}
