import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ErdPointDto {
  @ApiProperty({ example: 120 })
  x: number

  @ApiProperty({ example: 80 })
  y: number
}

export class ErdShowFlagsDto {
  @ApiProperty({ example: true })
  tableComment: boolean

  @ApiProperty({ example: true })
  columnDomain: boolean

  @ApiProperty({ example: true })
  columnType: boolean

  @ApiProperty({ example: true })
  columnNotNull: boolean

  @ApiProperty({ example: false })
  columnDefault: boolean

  @ApiProperty({ example: false })
  columnComment: boolean

  @ApiProperty({ example: true })
  columnUnique: boolean

  @ApiProperty({ example: true })
  columnAutoIncrement: boolean
}

export class ErdViewSettingsDto {
  @ApiProperty({ enum: ['both', 'logical', 'physical'], example: 'both' })
  nameMode: 'both' | 'logical' | 'physical'

  @ApiProperty({ type: ErdShowFlagsDto })
  show: ErdShowFlagsDto
}

export class ErdSchemaDto {
  @ApiProperty({ example: 'sch_public' })
  id: string

  @ApiProperty({ example: 'public' })
  name: string
}

export class ErdColumnDto {
  @ApiProperty({ example: 'col_id' })
  id: string

  @ApiProperty({ example: '아이디' })
  logicalName: string

  @ApiProperty({ example: 'id' })
  physicalName: string

  @ApiProperty({ example: 'bigint' })
  type: string

  @ApiPropertyOptional({ example: '20' })
  length?: string

  @ApiProperty({ example: true })
  pk: boolean

  @ApiProperty({ example: false })
  fk: boolean

  @ApiProperty({ example: true })
  nn: boolean

  @ApiProperty({ example: false })
  unique: boolean

  @ApiProperty({ example: true })
  autoIncrement: boolean

  @ApiPropertyOptional({ example: '0' })
  defaultValue?: string

  @ApiPropertyOptional({ example: '기본키' })
  comment?: string

  @ApiPropertyOptional({ example: 'dom_uuid' })
  domainId?: string
}

export class ErdTableDto {
  @ApiProperty({ example: 'tbl_users' })
  id: string

  @ApiProperty({ example: 'sch_public' })
  schemaId: string

  @ApiProperty({ example: '사용자' })
  logicalName: string

  @ApiProperty({ example: 'users' })
  physicalName: string

  @ApiPropertyOptional({ example: '로그인 계정' })
  comment?: string

  @ApiProperty({ example: '#3B82F6' })
  color: string

  @ApiProperty({ type: ErdPointDto })
  position: ErdPointDto

  @ApiProperty({ type: [ErdColumnDto] })
  columns: ErdColumnDto[]
}

export class ErdRelationDto {
  @ApiProperty({ example: 'rel_1' })
  id: string

  @ApiPropertyOptional({ example: 'users_orders' })
  name?: string

  @ApiProperty({ example: 'tbl_orders' })
  sourceTableId: string

  @ApiProperty({ example: 'tbl_users' })
  targetTableId: string

  @ApiProperty({ type: [String], example: ['col_user_id'] })
  sourceColumnIds: string[]

  @ApiProperty({ type: [String], example: ['col_id'] })
  targetColumnIds: string[]

  @ApiProperty({
    enum: ['identifying', 'non-identifying'],
    example: 'non-identifying',
  })
  kind: 'identifying' | 'non-identifying'

  @ApiProperty({ enum: ['1', 'N'], example: 'N' })
  sourceCardinality: '1' | 'N'

  @ApiProperty({ enum: ['1', 'N'], example: '1' })
  targetCardinality: '1' | 'N'

  @ApiPropertyOptional({
    enum: ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT'],
  })
  onDelete?: string

  @ApiPropertyOptional({
    enum: ['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT'],
  })
  onUpdate?: string
}

export class ErdNoteDto {
  @ApiProperty({ example: 'note_1' })
  id: string

  @ApiProperty({ example: '메모' })
  text: string

  @ApiProperty({ example: '#FEF3C7' })
  color: string

  @ApiProperty({ type: ErdPointDto })
  position: ErdPointDto

  @ApiProperty({ example: 220 })
  width: number

  @ApiProperty({ example: 120 })
  height: number
}

export class ErdDomainDto {
  @ApiProperty({ example: 'dom_uuid' })
  id: string

  @ApiProperty({ example: 'UUID' })
  name: string

  @ApiProperty({ example: 'char' })
  type: string

  @ApiPropertyOptional({ example: '36' })
  length?: string

  @ApiProperty({ example: true })
  nn: boolean
}

export class ErdDocumentDto {
  @ApiProperty({ type: [ErdSchemaDto] })
  schemas: ErdSchemaDto[]

  @ApiProperty({ type: [ErdTableDto] })
  tables: ErdTableDto[]

  @ApiProperty({ type: [ErdRelationDto] })
  relations: ErdRelationDto[]

  @ApiProperty({ type: [ErdNoteDto] })
  notes: ErdNoteDto[]

  @ApiProperty({ type: [ErdDomainDto] })
  domains: ErdDomainDto[]

  @ApiProperty({ type: ErdViewSettingsDto })
  settings: ErdViewSettingsDto
}

export class DatabaseModelDto {
  @ApiProperty({
    description: '정규화된 DB 모델이에요. schemas/tables/columns/PK/FK/indexes 등을 담아요.',
    type: 'object',
    additionalProperties: true,
  })
  schemas: unknown

  @ApiProperty({ type: 'object', additionalProperties: true })
  tables: unknown

  @ApiProperty({ type: 'object', additionalProperties: true })
  columns: unknown

  @ApiProperty({ type: 'object', additionalProperties: true })
  primaryKeys: unknown

  @ApiProperty({ type: 'object', additionalProperties: true })
  foreignKeys: unknown

  @ApiProperty({ type: 'object', additionalProperties: true })
  indexes: unknown

  @ApiProperty({ type: 'object', additionalProperties: true })
  constraints: unknown

  @ApiProperty({ type: 'object', additionalProperties: true })
  domains: unknown
}

export class CanvasModelDto {
  @ApiProperty({
    description: '캔버스용 모델이에요. 테이블 위치·노트·관계선·표시 설정을 담아요.',
    type: 'object',
    additionalProperties: true,
  })
  tables: unknown

  @ApiProperty({ type: 'object', additionalProperties: true })
  notes: unknown

  @ApiProperty({ type: 'object', additionalProperties: true })
  relations: unknown

  @ApiProperty({ type: ErdViewSettingsDto })
  settings: ErdViewSettingsDto

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  viewport?: unknown
}

export class VersionSnapshotDto {
  @ApiProperty({ example: 'erd-studio-version' })
  kind: 'erd-studio-version'

  @ApiProperty({ example: '2026-09-07T00:00:00.000Z' })
  capturedAt: string

  @ApiProperty({ type: DatabaseModelDto })
  databaseModel: DatabaseModelDto

  @ApiProperty({ type: CanvasModelDto })
  canvas: CanvasModelDto
}
