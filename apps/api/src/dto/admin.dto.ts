import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class AdminUserQueryDto {
  @ApiPropertyOptional({
    description: '이름 또는 이메일에서 찾아요.',
    example: 'kim',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string

  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number

  @ApiPropertyOptional({
    description: '관리자 목록이 필요할 때만 true로 보내 주세요. 사용자 관리 목록에는 관리자가 안 나와요.',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  adminsOnly?: boolean
}

export class AddAdminDto {
  @ApiProperty({
    description: '관리자로 올릴, 이미 가입·인증된 계정의 이메일이에요.',
    example: 'ops@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string
}

export class UpdateAdminDto {
  @ApiProperty({
    description: '관리자 여부를 바꿔요. 마지막 관리자는 내릴 수 없어요.',
    example: true,
  })
  @IsBoolean()
  isAdmin: boolean
}

export class SuspendUserDto {
  @ApiProperty({
    description: '계정을 정지하면 로그인과 편집을 할 수 없어요. 다시 false로 보내면 풀어 줘요.',
    example: true,
  })
  @IsBoolean()
  suspended: boolean
}
