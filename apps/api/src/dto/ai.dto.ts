import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { ErdDocumentDto } from './erd-document.dto'

const AI_PROVIDER = ['openai', 'gemini', 'other'] as const

export class GenerateErdDto {
  @ApiProperty({
    description:
      '만들고 싶은 도메인을 한두 문장으로 적어 주세요. 예: `블로그: 사용자, 글, 댓글`',
    example: '쇼핑몰: 사용자, 상품, 주문, 주문항목',
    minLength: 2,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  prompt: string

  @ApiProperty({
    description: 'API 키(BYOK). 서버에 저장하지 않아요. ChatGPT는 `sk-…`, Gemini는 `AQ.…`/`AIza…` 형태예요.',
    example: 'sk-...',
    minLength: 8,
    maxLength: 512,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  apiKey: string

  @ApiProperty({
    enum: AI_PROVIDER,
    description: '`openai` | `gemini` | `other`(OpenAI 호환 커스텀).',
    example: 'openai',
  })
  @IsIn(AI_PROVIDER)
  provider: 'openai' | 'gemini' | 'other'

  @ApiPropertyOptional({
    description:
      '`other`일 때 **필수**. OpenAI 호환 https 베이스 URL. 사설망·localhost·메타데이터 호스트는 막아요. 예: `https://integrate.api.nvidia.com/v1`',
    example: 'https://integrate.api.nvidia.com/v1',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string

  @ApiPropertyOptional({
    description: '모델 이름. 비우면 제공자 기본값을 써요.',
    example: 'gpt-4o-mini',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string

  @ApiPropertyOptional({
    description: '추가 힌트(방언·명명 규칙 등). 비워도 돼요.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  hint?: string
}

export class GenerateErdResponseDto {
  @ApiProperty({ type: ErdDocumentDto })
  document: ErdDocumentDto

  @ApiProperty({
    enum: AI_PROVIDER,
    description: '사용한 제공자예요.',
    example: 'openai',
  })
  source: 'openai' | 'gemini' | 'other'
}

export class AiStatusResponseDto {
  @ApiProperty({
    description: 'AI 초안 만들기를 쓸 수 있으면 true예요. 사용자 API 키가 필요해요.',
    example: true,
  })
  available: boolean

  @ApiProperty({
    description: '요청마다 사용자 API 키가 필요하면 true예요.',
    example: true,
  })
  requiresApiKey: boolean

  @ApiProperty({
    enum: AI_PROVIDER,
    isArray: true,
    example: ['openai', 'gemini', 'other'],
  })
  providers: Array<'openai' | 'gemini' | 'other'>

  @ApiProperty({
    description: '제공자별 기본 모델.',
    example: {
      openai: 'gpt-4o-mini',
      gemini: 'gemini-2.0-flash',
      other: '',
    },
  })
  defaultModels: { openai: string; gemini: string; other: string }
}

export class ListAiModelsDto {
  @ApiProperty({
    description: 'API 키. 서버에 저장하지 않아요.',
    example: 'sk-...',
    minLength: 8,
    maxLength: 512,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  apiKey: string

  @ApiProperty({
    enum: AI_PROVIDER,
    example: 'openai',
  })
  @IsIn(AI_PROVIDER)
  provider: 'openai' | 'gemini' | 'other'

  @ApiPropertyOptional({
    description:
      '`other`일 때 **필수**. OpenAI 호환 https 베이스 URL.',
    example: 'https://integrate.api.nvidia.com/v1',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string
}

export class AiModelOptionDto {
  @ApiProperty({ example: 'gpt-4o-mini' })
  id: string

  @ApiProperty({ example: 'gpt-4o-mini' })
  label: string
}

export class ListAiModelsResponseDto {
  @ApiProperty({ type: [AiModelOptionDto] })
  models: AiModelOptionDto[]

  @ApiProperty({ example: 'gpt-4o-mini' })
  defaultModel: string
}

export class AiChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'], example: 'user' })
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant'

  @ApiProperty({
    description: '대화 내용. assistant는 짧은 설명만 보내면 돼요.',
    maxLength: 4000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string
}

export class ChatErdDto {
  @ApiProperty({
    description: '지금 보낼 사용자 메시지예요.',
    example: '주문 테이블에 배송지를 추가해 줘',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string

  @ApiProperty({
    description: 'API 키(BYOK). ChatGPT `sk-…`, Gemini `AQ.…`/`AIza…`.',
    example: 'sk-...',
    minLength: 8,
    maxLength: 512,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(512)
  apiKey: string

  @ApiProperty({ enum: AI_PROVIDER, example: 'openai' })
  @IsIn(AI_PROVIDER)
  provider: 'openai' | 'gemini' | 'other'

  @ApiPropertyOptional({
    description:
      '`other`일 때 **필수**. OpenAI 호환 https 베이스 URL.',
    example: 'https://integrate.api.nvidia.com/v1',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  baseUrl?: string

  @ApiProperty({
    description: '현재 캔버스 ERD. 수정 기준이 돼요.',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  document: Record<string, unknown>

  @ApiPropertyOptional({
    type: [AiChatMessageDto],
    description:
      '직전 대화. 서버에 저장하지 않아요. 실제로는 최근 6턴·메시지당 약 800자만 모델에 전달해요.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiChatMessageDto)
  history?: AiChatMessageDto[]

  @ApiPropertyOptional({
    description: '모델 이름. 비우면 제공자 기본값.',
    example: 'gpt-4o-mini',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string
}

export class ChatErdResponseDto {
  @ApiProperty({
    description: '사용자에게 보여줄 짧은 답변이에요.',
    example: '주문 테이블에 shipping_address 컬럼을 추가했어요.',
  })
  message: string

  @ApiPropertyOptional({
    type: ErdDocumentDto,
    description:
      '변경이 있을 때만 내려요(`applied=true`). 모델 patch를 서버가 병합한 **전체** ERD예요. notes/domains/settings는 요청 문서를 유지해요.',
  })
  document?: ErdDocumentDto

  @ApiProperty({
    description: '다이어그램이 바뀌었으면 true예요. false면 `document`가 없을 수 있어요.',
    example: true,
  })
  applied: boolean

  @ApiProperty({ enum: AI_PROVIDER, example: 'openai' })
  source: 'openai' | 'gemini' | 'other'
}
