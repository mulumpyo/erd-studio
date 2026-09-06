import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ErdDocumentDto } from './erd-document.dto'

export class ExportSqlResponseDto {
  @ApiProperty({
    description: '생성된 SQL 문이에요.',
    example: 'CREATE TABLE users (...);',
  })
  sql: string
}

export class ImportSqlResponseDto {
  @ApiProperty({ type: ErdDocumentDto })
  document: ErdDocumentDto
}

export class HealthResponseDto {
  @ApiProperty({
    description:
      '운영 환경에서는 Redis ping 결과예요. 그 외 환경에서는 서버가 떠 있으면 true예요.',
    example: true,
  })
  ok: boolean

  @ApiPropertyOptional({
    description: '비운영 환경에서만 줘요.',
    example: 'erd-studio-api',
  })
  service?: string

  @ApiPropertyOptional({
    description: '비운영 환경에서 Redis ping 결과예요.',
    example: true,
  })
  redis?: boolean
}

export class NotifyChatEventDto {
  @ApiProperty({ example: 'chat' })
  type: 'chat'

  @ApiProperty()
  projectId: string

  @ApiPropertyOptional()
  body?: string

  @ApiPropertyOptional()
  userName?: string

  @ApiPropertyOptional()
  projectName?: string

  @ApiPropertyOptional({ nullable: true })
  teamName?: string | null

  @ApiPropertyOptional()
  createdAt?: string
}

export class NotifyInviteEventDto {
  @ApiProperty({
    enum: ['invite', 'invite-declined', 'invite-accepted'],
    example: 'invite',
  })
  type: 'invite' | 'invite-declined' | 'invite-accepted'
}

export class NotifyTeamEventDto {
  @ApiProperty({ example: 'team' })
  type: 'team'

  @ApiProperty()
  teamId: string
}

export class NotifyProjectEventDto {
  @ApiProperty({ example: 'project' })
  type: 'project'

  @ApiProperty()
  teamId: string

  @ApiPropertyOptional()
  projectId?: string
}

export const NOTIFY_SSE_DESCRIPTION =
  'SSE 연결이에요. `event: notify`로 JSON이 오고, 주기적으로 `: ping` 하트비트가 와요.\n\n' +
  '`type` 값:\n' +
  '- `chat` — 새 채팅 (`projectId`, `body?`, `userName?`, `projectName?`, `teamName?`, `createdAt?`)\n' +
  '- `invite` / `invite-accepted` / `invite-declined` — 초대 관련\n' +
  '- `team` — 팀 멤버십 변경 (`teamId`)\n' +
  '- `project` — 팀 프로젝트 변경 (`teamId`, `projectId?`)\n\n' +
  '알림이 오면 목록 API를 다시 받으면 돼요.'

