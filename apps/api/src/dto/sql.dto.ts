import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator'
import type { SqlDialect } from '@erd-studio/sql'
import type { ErdDocument } from '@erd-studio/shared'

const DIALECTS = ['mysql', 'postgres', 'mssql', 'oracle'] as const

export class ExportSqlDto {
  @ApiProperty({
    description: 'SQL로 바꿀 다이어그램이에요. 프로젝트 스냅샷을 그대로 넣으면 돼요.',
    type: 'object',
    additionalProperties: true,
    example: {
      tables: [{ id: 'orders', name: 'orders', columns: [] }],
      relations: [],
    },
  })
  @IsObject()
  document: ErdDocument

  @ApiProperty({
    description: '어느 데이터베이스 문법으로 만들지 골라요.',
    enum: DIALECTS,
    example: 'postgres',
  })
  @IsIn(DIALECTS)
  dialect: SqlDialect
}

export class ImportSqlDto {
  @ApiProperty({
    description:
      '읽어 들일 `CREATE TABLE` 문이에요. 여러 개를 붙여서 한 번에 보내도 돼요.',
    example:
      'CREATE TABLE orders (\n  id BIGINT PRIMARY KEY,\n  user_id BIGINT NOT NULL\n);',
    maxLength: 400_000,
  })
  @IsString()
  @MaxLength(400_000)
  sql: string

  @ApiPropertyOptional({
    description: 'SQL이 어느 문법인지 알려줘요. 비우면 알아서 짐작해 볼게요.',
    enum: DIALECTS,
    example: 'postgres',
  })
  @IsOptional()
  @IsIn(DIALECTS)
  dialect?: SqlDialect
}
