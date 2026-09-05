import { Injectable } from '@nestjs/common'
import type { AuthUser } from '../common/auth/current-user'
import { assertEdit, assertParticipant } from '../common/access'
import { NotifyService } from './notify.service'
import { ProjectsService } from './projects.service'
import { PrismaService } from './prisma.service'

const chatUserSelect = { id: true, name: true, email: true } as const

const accessWhere = (userId: string) => ({
  OR: [
    { ownerId: userId },
    { members: { some: { userId } } },
    { team: { members: { some: { userId } } } },
  ],
})

@Injectable()
export class ChatService {
  constructor(
    private projects: ProjectsService,
    private prisma: PrismaService,
    private notify: NotifyService,
  ) {}

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
    await this.notify.publishChat(projectId, user.id, {
      body: created.body,
      userName: created.user.name,
      projectName: project.name,
      teamName:
        (project.team as { name?: string } | null | undefined)?.name ?? null,
      createdAt: created.createdAt.toISOString(),
    })
    return created
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
