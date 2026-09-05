import { Injectable } from '@nestjs/common'
import type { AuthUser } from '../common/auth/current-user'
import { assertEdit, assertParticipant } from '../common/access'
import { ProjectsService } from './projects.service'
import { PrismaService } from './prisma.service'

const chatUserSelect = { id: true, name: true, email: true } as const

@Injectable()
export class ChatService {
  constructor(
    private projects: ProjectsService,
    private prisma: PrismaService,
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
    return this.prisma.chatMessage.create({
      data: { projectId, userId: user.id, body },
      include: { user: { select: chatUserSelect } },
    })
  }

  inbox = async (user: AuthUser) => {
    const access = {
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
        { team: { members: { some: { userId: user.id } } } },
      ],
    }
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
      })
      if (items.length >= 20) break
    }
    return items
  }
}
