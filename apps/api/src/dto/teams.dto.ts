import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator'

export class CreateTeamDto {
  @ApiProperty({
    description: '팀 이름이에요. 만든 사람이 소유자가 돼요.',
    example: '백엔드 팀',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  name: string
}

export class InviteTeamMemberDto {
  @ApiProperty({
    description:
      '초대할 사람의 이메일이에요. 아직 가입하지 않았다면 가입한 뒤 자동으로 팀에 들어와요.',
    example: 'teammate@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string

  @ApiPropertyOptional({
    description:
      '팀 프로젝트에서 가질 권한이에요. 비우면 `editor`로 초대해요.',
    enum: ['editor', 'viewer'],
    example: 'editor',
    default: 'editor',
  })
  @IsOptional()
  @IsIn(['editor', 'viewer'])
  role?: string
}

export class UpdateTeamMemberDto {
  @ApiProperty({
    description: '바꿀 권한이에요. 소유자 권한은 넘길 수 없어요.',
    enum: ['editor', 'viewer'],
    example: 'viewer',
  })
  @IsIn(['editor', 'viewer'])
  role: string
}
