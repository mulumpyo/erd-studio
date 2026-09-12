import { Body, Controller, Get, Post } from '@nestjs/common'
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import {
  aiFeaturesEnabled,
  assertAiEnabled,
  disabledAiStatus,
} from '../common/ai-features'
import { Auth } from '../common/auth/decorators'
import {
  AiStatusResponseDto,
  ChatErdDto,
  ChatErdResponseDto,
  GenerateErdDto,
  GenerateErdResponseDto,
  ListAiModelsDto,
  ListAiModelsResponseDto,
} from '../dto/ai.dto'
import { ErrorResponseDto } from '../dto/common-response.dto'
import { AiService } from '../services/ai.service'

@ApiTags('ai')
@ApiTooManyRequestsResponse({
  description: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.',
  type: ErrorResponseDto,
})
@ApiServiceUnavailableResponse({
  description:
    '`AI_FEATURES_ENABLED`가 꺼져 있으면 생성·채팅·모델 목록은 503이에요. `GET /ai/status`는 항상 200이며 `available: false`예요.',
  type: ErrorResponseDto,
})
@Controller('ai')
@Auth()
export class AiController {
  constructor(private ai: AiService) {}

  @ApiOperation({
    summary: 'AI 사용 가능 여부 보기',
    description:
      'AI 기능을 쓸 수 있는지와 제공자(`openai` / `gemini` / `other`)별 기본 모델을 알려줘요. 요청마다 사용자 API 키(BYOK)가 필요해요.',
  })
  @ApiOkResponse({ type: AiStatusResponseDto })
  @Get('status')
  status() {
    if (!aiFeaturesEnabled()) return disabledAiStatus()
    return this.ai.status()
  }

  @ApiOperation({
    summary: '사용 가능한 모델 목록 보기',
    description:
      '사용자 API 키로 제공자 모델 목록을 조회해요. `openai`·`gemini`·`other`(OpenAI 호환 `baseUrl`)를 지원하고, 채팅용 모델만 남겨 줘요. 키는 저장하지 않아요.',
  })
  @ApiOkResponse({ type: ListAiModelsResponseDto })
  @Post('models')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  listModels(@Body() dto: ListAiModelsDto) {
    assertAiEnabled()
    return this.ai.listModels(dto.provider, dto.apiKey, dto.baseUrl)
  }

  @ApiOperation({
    summary: '설명으로 ERD 초안 만들기',
    description:
      '한두 문장으로 도메인을 설명하면 테이블·컬럼·간단 관계가 담긴 다이어그램 초안을 줘요.\n\n' +
      '`provider`는 `openai` / `gemini` / `other`(OpenAI 호환)이고, `other`는 `baseUrl`이 필요해요. `apiKey`는 요청마다 보내며 서버에는 저장하지 않아요.',
  })
  @ApiCreatedResponse({ type: GenerateErdResponseDto })
  @Post('generate')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  generate(@Body() dto: GenerateErdDto) {
    assertAiEnabled()
    return this.ai.generate({
      prompt: dto.prompt,
      apiKey: dto.apiKey,
      provider: dto.provider,
      model: dto.model,
      hint: dto.hint,
      baseUrl: dto.baseUrl,
    })
  }

  @ApiOperation({
    summary: '대화로 ERD 수정하기',
    description:
      '현재 다이어그램과 최근 대화를 보내면, 요청에 맞게 수정한 ERD와 짧은 설명을 줘요.\n\n' +
      '서버는 관련 테이블만 모델에 넘기고, 모델은 upsertColumns/patch/`unchanged`/full document로 답한 뒤 서버가 병합해요. ' +
      '`applied=false`(질문만 등)이면 응답에 `document`를 생략해요. ' +
      '`history`는 최근 6턴·메시지당 약 800자만 사용해요. 키·대화는 저장하지 않아요. `other`는 OpenAI 호환 `baseUrl`이 필요해요.',
  })
  @ApiCreatedResponse({ type: ChatErdResponseDto })
  @Post('chat')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  chat(@Body() dto: ChatErdDto) {
    assertAiEnabled()
    return this.ai.chat({
      message: dto.message,
      apiKey: dto.apiKey,
      provider: dto.provider,
      document: dto.document,
      history: dto.history,
      model: dto.model,
      baseUrl: dto.baseUrl,
    })
  }
}
