import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

export class CreateProjectDto {
  @ApiProperty({
    description: '프로젝트 이름이에요.',
    example: '주문 서비스 ERD',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  name: string

  @ApiPropertyOptional({
    description:
      '팀 프로젝트로 만들 때 팀 ID를 넣어요. 비우면 나만의 프로젝트로 만들어요.',
    example: 'clz9k2p4x0001s601abcdefgh',
  })
  @IsOptional()
  @IsString()
  teamId?: string

  @ApiPropertyOptional({
    description: '`true`면 빈 화면 대신 예시 다이어그램을 담아서 만들어요.',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  fromSample?: boolean
}

export class UpdateProjectDto {
  @ApiPropertyOptional({
    description: '새 프로젝트 이름이에요.',
    example: '주문 서비스 ERD v2',
  })
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional({
    description:
      '`true`로 두면 공유 링크를 아는 사람은 로그인 없이 볼 수 있어요. 소유자만 바꿀 수 있어요.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean

  @ApiPropertyOptional({
    description: '프로젝트를 한 줄로 설명해요.',
    example: '주문, 결제, 배송 도메인을 담은 다이어그램이에요.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string

  @ApiPropertyOptional({
    description: '찾기 쉽게 붙이는 태그예요. 최대 12개까지 담을 수 있어요.',
    example: ['주문', '결제'],
    type: [String],
    maxItems: 12,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(24, { each: true })
  tags?: string[]
}

export class SnapshotDto {
  @ApiProperty({
    description:
      '지금 화면의 다이어그램 전체예요. 테이블, 관계, 메모, 보기 설정이 함께 들어가요.',
    type: 'object',
    additionalProperties: true,
    example: {
      tables: [{ id: 'orders', name: 'orders', columns: [] }],
      relations: [],
      notes: [],
    },
  })
  @IsObject()
  snapshot: object
}

export class VersionDto {
  @ApiPropertyOptional({
    description: '나중에 알아보기 쉽게 붙이는 버전 이름이에요.',
    example: '결제 테이블 추가',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string

  @ApiPropertyOptional({
    description:
      '저장할 다이어그램이에요. 비우면 지금 서버에 저장된 내용을 그대로 버전으로 남겨요.',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  document?: object
}

export class InviteMemberDto {
  @ApiProperty({
    description:
      '초대할 사람의 이메일이에요. 아직 가입하지 않았어도 초대 메일을 보내 둬요.',
    example: 'teammate@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string

  @ApiPropertyOptional({
    description: '줄 권한이에요. 비우면 `editor`로 초대해요.',
    enum: ['editor', 'viewer'],
    example: 'editor',
    default: 'editor',
  })
  @IsOptional()
  @IsIn(['editor', 'viewer'])
  role?: string
}

export class UpdateMemberDto {
  @ApiProperty({
    description: '바꿀 권한이에요. 소유자 권한은 넘길 수 없어요.',
    enum: ['editor', 'viewer'],
    example: 'viewer',
  })
  @IsIn(['editor', 'viewer'])
  role: string
}
