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
    return this.prisma.chatMessage.create({
      data: { projectId, userId: user.id, body },
      include: { user: { select: chatUserSelect } },
    })
  }
}
