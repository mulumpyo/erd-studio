import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class ListQueryDto {
  @ApiPropertyOptional({
    description: '검색어예요. 이름에 이 말이 들어간 것만 골라 줘요.',
    example: '주문',
    maxLength: 80,
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string

  @ApiPropertyOptional({
    description: '몇 번째 페이지를 볼지 정해요. 1부터 시작해요.',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number

  @ApiPropertyOptional({
    description: '한 페이지에 몇 개를 담을지 정해요. 최대 50개까지 받아요.',
    example: 8,
    minimum: 1,
    maximum: 50,
    default: 8,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number
}

export class ProjectListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    description: '특정 팀의 프로젝트만 보고 싶을 때 팀 ID를 넣어요.',
    example: 'clz9k2p4x0001s601abcdefgh',
  })
  @IsOptional()
  @IsString()
  teamId?: string
}
