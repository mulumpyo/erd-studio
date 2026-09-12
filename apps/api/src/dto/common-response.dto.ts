import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class OkResponseDto {
  @ApiProperty({ description: '요청이 처리됐어요.', example: true })
  ok: true
}

/** OpenAPI·클라이언트용 공통 오류 응답 모양이에요. */
export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP 상태 코드예요.',
    example: 400,
  })
  statusCode: number

  @ApiProperty({
    description:
      '사람이 읽을 메시지예요. 문자열 하나이거나 검증 오류면 문자열 배열일 수 있어요.',
    example: 'AI 기능은 준비 중이에요.',
  })
  message: string | string[]

  @ApiPropertyOptional({
    description: '짧은 오류 이름이에요. 운영 환경의 일부 5xx에서는 생략될 수 있어요.',
    example: 'Bad Request',
  })
  error?: string
}

export class UserBriefDto {
  @ApiProperty({ example: 'clz9k2p4x0005s601ghijklmn' })
  id: string

  @ApiProperty({ example: '홍길동' })
  name: string

  @ApiProperty({ example: 'hong@example.com', format: 'email' })
  email: string
}

export class NamedUserDto {
  @ApiProperty({ example: 'clz9k2p4x0005s601ghijklmn' })
  id: string

  @ApiProperty({ example: '홍길동' })
  name: string
}

export class PendingInvitationDto {
  @ApiProperty({ example: 'clz9k2p4x0004s601yzabcdef' })
  id: string

  @ApiProperty({ example: 'kim@example.com', format: 'email' })
  email: string

  @ApiPropertyOptional({
    nullable: true,
    description: '이미 가입한 계정이면 이름이에요.',
    example: '김철수',
  })
  name?: string | null

  @ApiProperty({
    description: '초대 역할이에요.',
    enum: ['owner', 'editor', 'viewer'],
    example: 'editor',
  })
  role: string

  @ApiProperty({
    description: '초대가 만료되는 시각(ISO)이에요.',
    example: '2026-09-14T00:00:00.000Z',
  })
  expiresAt: string

  @ApiProperty({
    description: '초대를 만든 시각(ISO)이에요.',
    example: '2026-09-07T00:00:00.000Z',
  })
  createdAt: string

  @ApiPropertyOptional({
    description:
      '방금 만들거나 다시 보낸 초대에만 붙는 수락 링크예요. 목록 조회에는 보통 없어요.',
    example: 'https://app.example.com/invite/Zx8Z1t0pV9xK7mB2nR8yZ4wL6cJ5hD0a',
  })
  inviteUrl?: string
}

export class InviteCreatedResponseDto {
  @ApiProperty({ example: 'invited' })
  status: 'invited'

  @ApiProperty({ type: PendingInvitationDto })
  invitation: PendingInvitationDto

  @ApiProperty({
    description: '메일 전송에 성공했으면 true예요. 메일 설정이 없으면 false예요.',
    example: true,
  })
  mailed: boolean
}

export class InviteResendResponseDto {
  @ApiProperty({ type: PendingInvitationDto })
  invitation: PendingInvitationDto

  @ApiProperty({ example: true })
  mailed: boolean
}

export class PageMetaDto {
  @ApiProperty({ description: '조건에 맞는 전체 개수예요.', example: 42 })
  total: number

  @ApiProperty({ description: '지금 페이지 번호예요.', example: 1 })
  page: number

  @ApiProperty({ description: '페이지당 개수예요.', example: 8 })
  limit: number

  @ApiProperty({ description: '전체 페이지 수예요.', example: 6 })
  pages: number
}
