import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { UserBriefDto } from './common-response.dto'

export class ChatInboxItemDto {
  @ApiProperty()
  projectId: string

  @ApiProperty({ example: '주문 서비스 ERD' })
  projectName: string

  @ApiPropertyOptional({ nullable: true, example: '주문팀' })
  teamName: string | null

  @ApiProperty({ example: 'FK 이름 맞췄어요' })
  body: string

  @ApiProperty({ example: '홍길동' })
  userName: string

  @ApiProperty()
  userId: string

  @ApiProperty({ example: '2026-09-07T08:00:00.000Z' })
  createdAt: string

  @ApiProperty({ example: 2 })
  unreadCount: number
}

export class ChatMessageDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  projectId: string

  @ApiProperty()
  userId: string

  @ApiProperty({ example: '관계선 확인 부탁해요' })
  body: string

  @ApiProperty({ example: '2026-09-07T08:00:00.000Z' })
  createdAt: string

  @ApiProperty({ type: UserBriefDto })
  user: UserBriefDto
}
