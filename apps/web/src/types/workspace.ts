export type WorkspaceUser = { id?: string; name: string; email: string }

export type TeamMember = {
  userId: string
  role: string
  user: WorkspaceUser
}

export type PendingInvitation = {
  id: string
  email: string
  role: string
  expiresAt: string
  createdAt: string
  inviteUrl?: string
}

export type PageResult<T> = {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export type Team = {
  id: string
  name: string
  ownerId: string
  members: TeamMember[]
  invitations?: PendingInvitation[]
  _count?: { projects: number }
}

export type Project = {
  id: string
  name: string
  description?: string | null
  tags?: string[]
  ownerId: string
  updatedAt: string
  team?: { id: string; name: string } | null
  members?: Array<{ userId: string; role: string }>
  _count?: { members: number }
}

export const isProjectOwner = (project: { ownerId: string }, userId?: string) =>
  Boolean(userId && project.ownerId === userId)

export const canLeaveProject = (
  project: { ownerId: string; members?: Array<{ userId: string }> },
  userId?: string,
) =>
  Boolean(
    userId &&
    project.ownerId !== userId &&
    project.members?.some((m) => m.userId === userId),
  )

export const canDeleteProject = (
  project: { ownerId: string },
  userId?: string,
  teamOwnerId?: string,
) => Boolean(userId && (project.ownerId === userId || teamOwnerId === userId))
