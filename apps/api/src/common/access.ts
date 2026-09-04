import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import {
  canDeleteProject,
  canEditProject,
  canManageMembers,
  canViewProject,
  isProjectParticipant,
  isSameTenant,
  isTeamOwned,
  type ProjectAccess,
} from '@erd-studio/shared'
import type { AuthUser } from './auth/current-user'

export {
  canDeleteProject,
  canEditProject,
  canManageMembers,
  canViewProject,
  isProjectParticipant,
  isSameTenant,
  isTeamOwned,
  type ProjectAccess,
}

export const userSelect = { id: true, name: true, email: true } as const

export const assertView = (
  user: AuthUser | null | undefined,
  project: ProjectAccess,
) => {
  if (canViewProject(user, project)) return
  throw new NotFoundException('프로젝트를 찾을 수 없습니다.')
}

export const assertParticipant = (
  user: AuthUser | null | undefined,
  project: ProjectAccess,
) => {
  if (isProjectParticipant(user, project)) return
  if (!user) throw new UnauthorizedException('로그인이 필요해요.')
  throw new ForbiddenException('이 프로젝트의 멤버만 볼 수 있어요.')
}

export const assertEdit = (user: AuthUser, project: ProjectAccess) => {
  if (!canEditProject(user, project))
    throw new ForbiddenException('편집 권한이 없습니다.')
}

export const assertManageMembers = (user: AuthUser, project: ProjectAccess) => {
  if (!canManageMembers(user, project))
    throw new ForbiddenException('멤버를 관리할 권한이 없습니다.')
}

export const assertDeleteProject = (user: AuthUser, project: ProjectAccess) => {
  if (!canDeleteProject(user, project))
    throw new ForbiddenException('프로젝트를 삭제할 권한이 없습니다.')
}

export const assertAdmin = (user: AuthUser) => {
  if (!user.isAdmin) throw new NotFoundException('찾을 수 없어요.')
}

export const assertDirectProjectMembers = (project: ProjectAccess) => {
  if (isTeamOwned(project)) {
    throw new ForbiddenException('팀 프로젝트의 멤버는 팀에서 관리합니다.')
  }
}

export const projectAccessInclude = {
  members: {
    include: { user: { select: userSelect } },
  },
  team: {
    include: {
      members: {
        include: { user: { select: userSelect } },
      },
    },
  },
  owner: { select: userSelect },
} as const
