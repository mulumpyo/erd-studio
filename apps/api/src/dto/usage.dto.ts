import { IsOptional, Matches } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class UsageQueryDto {
  @ApiPropertyOptional({
    description:
      '조회를 시작할 날짜예요. 한국 날짜 `YYYY-MM-DD`예요. 비우면 오늘부터 29일 전이에요.',
    example: '2026-08-06',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string

  @ApiPropertyOptional({
    description: '조회를 끝낼 날짜예요. 비우면 오늘이에요.',
    example: '2026-09-04',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string
}
