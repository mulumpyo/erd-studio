import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { OkResponseDto } from './common-response.dto'

export class InviteInboxItemDto {
  @ApiProperty()
  id: string

  @ApiProperty({ enum: ['incoming', 'accepted', 'declined'] })
  type: 'incoming' | 'accepted' | 'declined'

  @ApiProperty({ enum: ['team', 'project'] })
  kind: string

  @ApiProperty({ enum: ['owner', 'editor', 'viewer'] })
  role: string

  @ApiProperty({ example: '주문팀' })
  workspaceName: string

  @ApiProperty({ example: '홍길동' })
  inviterName: string

  @ApiProperty({ example: 'hong@example.com' })
  inviterEmail: string

  @ApiPropertyOptional({ nullable: true })
  inviteeName: string | null

  @ApiProperty({ example: 'kim@example.com' })
  inviteeEmail: string

  @ApiProperty()
  expiresAt: string

  @ApiPropertyOptional({ nullable: true })
  projectId: string | null

  @ApiPropertyOptional({ nullable: true })
  teamId: string | null
}

export class InvitePreviewResponseDto {
  @ApiProperty({ example: 'kim@example.com' })
  email: string

  @ApiProperty({ enum: ['owner', 'editor', 'viewer'] })
  role: string

  @ApiProperty({ enum: ['team', 'project'] })
  kind: string

  @ApiProperty({ example: '주문팀' })
  workspaceName: string

  @ApiProperty({ example: '홍길동' })
  inviterName: string

  @ApiProperty({ example: 'hong@example.com' })
  inviterEmail: string

  @ApiProperty()
  expiresAt: string

  @ApiProperty({
    enum: ['pending', 'accepted', 'declined', 'expired'],
    example: 'pending',
  })
  status: 'pending' | 'accepted' | 'declined' | 'expired'

  @ApiPropertyOptional({ nullable: true })
  teamId: string | null

  @ApiPropertyOptional({ nullable: true })
  projectId: string | null
}

export class InviteAcceptResponseDto {
  @ApiProperty({ example: true })
  ok: true

  @ApiProperty({ enum: ['team', 'project'] })
  kind: string

  @ApiPropertyOptional({ nullable: true })
  teamId: string | null

  @ApiPropertyOptional({ nullable: true })
  projectId: string | null
}

export { OkResponseDto }
