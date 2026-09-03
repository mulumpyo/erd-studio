import { Injectable } from '@nestjs/common'
import { PrismaService } from './prisma.service'
import { RedisService } from './redis.service'

export const COLLAB_KICK_CHANNEL = 'erd:collab:kick'

export type CollabKick = {
  projectId?: string
  userId?: string
}

@Injectable()
export class CollabAclService {
  constructor(
    private redis: RedisService,
    private prisma: PrismaService,
  ) {}

  kick = (payload: CollabKick) =>
    this.redis.client.publish(COLLAB_KICK_CHANNEL, JSON.stringify(payload))

  kickUser = (userId: string) => this.kick({ userId })

  kickFromProject = (projectId: string, userId?: string) =>
    this.kick({ projectId, userId })

  kickFromTeam = async (teamId: string, userId: string) => {
    const projects = await this.prisma.project.findMany({
      where: { teamId },
      select: { id: true },
    })
    await Promise.all(
      projects.map((project) => this.kickFromProject(project.id, userId)),
    )
  }
}
