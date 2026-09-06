import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  InviteCreatedResponseDto,
  InviteResendResponseDto,
  NamedUserDto,
  OkResponseDto,
  PageMetaDto,
  PendingInvitationDto,
  UserBriefDto,
} from './common-response.dto'
import {
  CanvasModelDto,
  DatabaseModelDto,
  ErdDocumentDto,
  VersionSnapshotDto,
} from './erd-document.dto'

export class SharedProjectResponseDto {
  @ApiProperty({ example: 'clz9k2p4x0001s601abcdefgh' })
  id: string

  @ApiProperty({ example: '주문 서비스 ERD' })
  name: string

  @ApiProperty({ example: true })
  isPublic: boolean
}

export class ProjectTeamRefDto {
  @ApiProperty({ example: 'clz9k2p4x0001s601abcdefgh' })
  id: string

  @ApiProperty({ example: '주문팀' })
  name: string
}

export class ProjectMemberDto {
  @ApiProperty()
  projectId: string

  @ApiProperty()
  userId: string

  @ApiProperty({ enum: ['owner', 'editor', 'viewer'], example: 'editor' })
  role: string

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  joinedAt: string

  @ApiProperty({ type: UserBriefDto })
  user: UserBriefDto
}

export class ProjectListItemDto {
  @ApiProperty()
  id: string

  @ApiProperty({ example: '주문 서비스 ERD' })
  name: string

  @ApiProperty()
  ownerId: string

  @ApiPropertyOptional({ nullable: true })
  teamId: string | null

  @ApiProperty({ example: false })
  isPublic: boolean

  @ApiPropertyOptional({ nullable: true, example: '주문 도메인' })
  description: string | null

  @ApiProperty({ type: [String], example: ['주문', '결제'] })
  tags: string[]

  @ApiProperty()
  createdAt: string

  @ApiProperty()
  updatedAt: string

  @ApiPropertyOptional({ type: ProjectTeamRefDto, nullable: true })
  team: ProjectTeamRefDto | null

  @ApiProperty({ type: [ProjectMemberDto] })
  members: ProjectMemberDto[]

  @ApiProperty({
    type: 'object',
    properties: { members: { type: 'number', example: 3 } },
  })
  _count: { members: number }
}

export class ProjectListResponseDto extends PageMetaDto {
  @ApiProperty({ type: [ProjectListItemDto] })
  items: ProjectListItemDto[]
}

export class TeamMemberDto {
  @ApiProperty()
  teamId: string

  @ApiProperty()
  userId: string

  @ApiProperty({ enum: ['owner', 'editor', 'viewer'] })
  role: string

  @ApiProperty()
  joinedAt: string

  @ApiProperty({ type: UserBriefDto })
  user: UserBriefDto
}

export class ProjectTeamDetailDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  name: string

  @ApiProperty()
  ownerId: string

  @ApiProperty()
  createdAt: string

  @ApiProperty({ type: [TeamMemberDto] })
  members: TeamMemberDto[]
}

export class ProjectDetailResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  name: string

  @ApiProperty()
  ownerId: string

  @ApiPropertyOptional({ nullable: true })
  teamId: string | null

  @ApiProperty()
  isPublic: boolean

  @ApiPropertyOptional({ nullable: true })
  description: string | null

  @ApiProperty({ type: [String] })
  tags: string[]

  @ApiPropertyOptional({
    type: ErdDocumentDto,
    nullable: true,
    description: '저장된 다이어그램이에요.',
  })
  snapshot: ErdDocumentDto | null

  @ApiProperty()
  createdAt: string

  @ApiProperty()
  updatedAt: string

  @ApiPropertyOptional({ type: UserBriefDto })
  owner?: UserBriefDto | NamedUserDto

  @ApiPropertyOptional({ type: ProjectTeamDetailDto, nullable: true })
  team?: ProjectTeamDetailDto | null

  @ApiProperty({ type: [ProjectMemberDto] })
  members: ProjectMemberDto[]

  @ApiProperty({
    description: '내가 참여자면 true예요. 공개 링크로만 본 경우 false예요.',
  })
  isParticipant: boolean

  @ApiProperty({ description: '편집할 수 있으면 true예요.' })
  canEdit: boolean

  @ApiPropertyOptional({
    description: '소유자·참여자 응답에만 있을 수 있어요.',
  })
  shareToken?: string

  @ApiPropertyOptional({
    nullable: true,
    description: '실시간 편집 상태. 보통 null이거나 내부용이에요.',
  })
  yjsState?: unknown
}

export class ProjectRecordResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  name: string

  @ApiProperty()
  ownerId: string

  @ApiPropertyOptional({ nullable: true })
  teamId: string | null

  @ApiProperty()
  isPublic: boolean

  @ApiProperty()
  shareToken: string

  @ApiPropertyOptional({ nullable: true })
  description: string | null

  @ApiProperty({ type: [String] })
  tags: string[]

  @ApiPropertyOptional({ nullable: true })
  yjsState: unknown

  @ApiPropertyOptional({ type: ErdDocumentDto, nullable: true })
  snapshot: ErdDocumentDto | null

  @ApiProperty()
  createdAt: string

  @ApiProperty()
  updatedAt: string

  @ApiPropertyOptional({ type: [ProjectMemberDto] })
  members?: ProjectMemberDto[]
}

export class VersionListItemDto {
  @ApiProperty()
  id: string

  @ApiPropertyOptional({ nullable: true, example: '결제 추가 전' })
  label: string | null

  @ApiProperty()
  createdAt: string

  @ApiPropertyOptional({ nullable: true })
  createdById: string | null

  @ApiPropertyOptional({ type: NamedUserDto, nullable: true })
  createdBy: NamedUserDto | null
}

export class VersionCreatedResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  projectId: string

  @ApiPropertyOptional({ nullable: true })
  label: string | null

  @ApiPropertyOptional({ nullable: true })
  createdById: string | null

  @ApiProperty()
  createdAt: string

  @ApiProperty({ type: VersionSnapshotDto })
  snapshot: VersionSnapshotDto

  @ApiPropertyOptional({ type: NamedUserDto, nullable: true })
  createdBy: NamedUserDto | null
}

export class VersionDetailResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  projectId: string

  @ApiPropertyOptional({
    nullable: true,
    description: '버전 이름이에요. 저장 시 `label`이 여기 `name`으로 와요.',
  })
  name: string | null

  @ApiProperty()
  createdAt: string

  @ApiPropertyOptional({ type: NamedUserDto, nullable: true })
  createdBy: NamedUserDto | null

  @ApiProperty({ type: DatabaseModelDto })
  databaseModelSnapshot: DatabaseModelDto

  @ApiProperty({ type: CanvasModelDto })
  canvasSnapshot: CanvasModelDto
}

export class TeamMembersSummaryDto {
  @ApiProperty()
  userId: string

  @ApiProperty({ enum: ['owner', 'editor', 'viewer'] })
  role: string

  @ApiProperty({ type: UserBriefDto })
  user: UserBriefDto
}

export class ProjectMembersTeamKindDto {
  @ApiProperty({ example: 'team' })
  kind: 'team'

  @ApiProperty({
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      ownerId: { type: 'string' },
    },
  })
  team: { id: string; name: string; ownerId: string }

  @ApiProperty({ type: [TeamMembersSummaryDto] })
  members: TeamMembersSummaryDto[]

  @ApiProperty({ type: [PendingInvitationDto], example: [] })
  invitations: PendingInvitationDto[]
}

export class ProjectMembersDirectKindDto {
  @ApiProperty({ example: 'project' })
  kind: 'project'

  @ApiProperty({ nullable: true, example: null })
  team: null

  @ApiProperty({ type: [ProjectMemberDto] })
  members: ProjectMemberDto[]

  @ApiProperty({ type: [PendingInvitationDto] })
  invitations: PendingInvitationDto[]
}

export {
  InviteCreatedResponseDto,
  InviteResendResponseDto,
  OkResponseDto,
}
