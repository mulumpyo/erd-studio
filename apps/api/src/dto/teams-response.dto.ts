import { ApiProperty } from '@nestjs/swagger'
import {
  InviteCreatedResponseDto,
  InviteResendResponseDto,
  OkResponseDto,
  PageMetaDto,
  PendingInvitationDto,
  UserBriefDto,
} from './common-response.dto'

export class TeamMemberResponseDto {
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

export class TeamResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty({ example: '주문팀' })
  name: string

  @ApiProperty()
  ownerId: string

  @ApiProperty()
  createdAt: string

  @ApiProperty({ type: [TeamMemberResponseDto] })
  members: TeamMemberResponseDto[]

  @ApiProperty({
    type: 'object',
    properties: { projects: { type: 'number', example: 4 } },
  })
  _count: { projects: number }

  @ApiProperty({ type: [PendingInvitationDto] })
  invitations: PendingInvitationDto[]
}

export class TeamCreatedResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  name: string

  @ApiProperty()
  ownerId: string

  @ApiProperty()
  createdAt: string

  @ApiProperty({ type: [TeamMemberResponseDto] })
  members: TeamMemberResponseDto[]
}

export class TeamListResponseDto extends PageMetaDto {
  @ApiProperty({ type: [TeamResponseDto] })
  items: TeamResponseDto[]
}

export {
  InviteCreatedResponseDto,
  InviteResendResponseDto,
  OkResponseDto,
}
