import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { PageMetaDto } from './common-response.dto'

export class AdminPublicUserDto {
  @ApiProperty()
  id: string

  @ApiProperty({ example: 'hong@example.com' })
  email: string

  @ApiProperty({ example: '홍길동' })
  name: string

  @ApiProperty({ example: false })
  isAdmin: boolean

  @ApiPropertyOptional({ nullable: true })
  emailVerifiedAt: string | null

  @ApiPropertyOptional({ nullable: true })
  suspendedAt: string | null

  @ApiProperty()
  createdAt: string

  @ApiProperty({
    description: '정지됐거나 사용할 수 없으면 true예요.',
    example: false,
  })
  locked: boolean
}

export class AdminOverviewUsersDto {
  @ApiProperty()
  total: number

  @ApiProperty()
  signedUpToday: number

  @ApiProperty()
  verifiedToday: number

  @ApiProperty()
  withdrawnToday: number

  @ApiProperty()
  withdrawnTotal: number
}

export class AdminOverviewUsageDto {
  @ApiProperty()
  dau: number

  @ApiProperty()
  wau: number

  @ApiProperty()
  mau: number
}

export class AdminOverviewPointDto {
  @ApiProperty({ example: '2026-09-07' })
  day: string

  @ApiProperty()
  dau: number

  @ApiProperty()
  wau: number

  @ApiProperty()
  mau: number

  @ApiProperty()
  withdrawn: number
}

export class AdminOverviewResponseDto {
  @ApiProperty({ example: 'Asia/Seoul' })
  timezone: string

  @ApiProperty({ example: '2026-09-07' })
  day: string

  @ApiProperty({ type: AdminOverviewUsersDto })
  users: AdminOverviewUsersDto

  @ApiProperty({ type: AdminOverviewUsageDto })
  usage: AdminOverviewUsageDto

  @ApiProperty({ type: [AdminOverviewPointDto] })
  points: AdminOverviewPointDto[]
}

export class AdminUsagePointDto {
  @ApiProperty({ example: '2026-09-07' })
  day: string

  @ApiProperty()
  dau: number

  @ApiProperty()
  wau: number

  @ApiProperty()
  mau: number
}

export class AdminUsageResponseDto {
  @ApiProperty({ example: 'Asia/Seoul' })
  timezone: string

  @ApiProperty({ example: '2026-08-09' })
  from: string

  @ApiProperty({ example: '2026-09-07' })
  to: string

  @ApiProperty({ type: [AdminUsagePointDto] })
  points: AdminUsagePointDto[]
}

export class AdminUserListResponseDto extends PageMetaDto {
  @ApiProperty({ type: [AdminPublicUserDto] })
  items: AdminPublicUserDto[]
}

export class AdminPasswordResetResponseDto {
  @ApiProperty({ example: true })
  mailed: boolean

  @ApiPropertyOptional({
    description:
      '메일을 보내지 못했고 개발용 매직 링크가 허용될 때만 붙어요.',
    example: 'https://app.example.com/reset/A1b2C3d4',
  })
  resetUrl?: string
}
