export type AccessUser = { id: string }

export type AccessMember = { userId: string; role: string }

export type ProjectAccess = {
  ownerId: string
  teamId?: string | null
  isPublic?: boolean
  members?: AccessMember[]
  team?: {
    ownerId?: string
    members: AccessMember[]
  } | null
}

export const isTeamScoped = (project: {
  teamId?: string | null
  team?: unknown | null
}) => Boolean(project.teamId || project.team)

export const isTeamOwned = isTeamScoped

export const teamMembership = (
  userId: string,
  project: ProjectAccess,
): AccessMember | undefined =>
  project.team?.members.find((member) => member.userId === userId)

export const projectMembership = (
  userId: string,
  project: ProjectAccess,
): AccessMember | undefined =>
  project.members?.find((member) => member.userId === userId)

export const isSameTenant = (
  user: AccessUser | null | undefined,
  project: ProjectAccess,
) => {
  if (!user) return false
  if (project.ownerId === user.id) return true
  if (isTeamScoped(project)) return Boolean(teamMembership(user.id, project))
  return Boolean(projectMembership(user.id, project))
}

export const findMembership = (userId: string, project: ProjectAccess) => {
  if (isTeamScoped(project)) {
    const team = teamMembership(userId, project)
    if (!team && project.ownerId !== userId) return undefined
    const overlay = projectMembership(userId, project)
    if (overlay) return overlay
    if (project.ownerId === userId) return { userId, role: 'owner' }
    return team
  }
  return projectMembership(userId, project)
}

export const isProjectParticipant = (
  user: AccessUser | null | undefined,
  project: ProjectAccess,
) => isSameTenant(user, project)

export const canViewProject = (
  user: AccessUser | null | undefined,
  project: ProjectAccess,
) => {
  if (project.isPublic) return true
  return isSameTenant(user, project)
}

export const canEditProject = (user: AccessUser, project: ProjectAccess) => {
  if (project.ownerId === user.id) return true
  if (!isSameTenant(user, project)) return false
  const member = findMembership(user.id, project)
  return Boolean(member && member.role !== 'viewer')
}

export const canManageMembers = (user: AccessUser, project: ProjectAccess) => {
  if (project.ownerId === user.id) return true
  if (!isSameTenant(user, project)) return false
  return findMembership(user.id, project)?.role === 'owner'
}

export const canDeleteProject = (user: AccessUser, project: ProjectAccess) => {
  if (project.ownerId === user.id) return true
  if (!isSameTenant(user, project)) return false
  return project.team?.ownerId === user.id
}
