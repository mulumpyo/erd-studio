import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { RedisService } from '../services/redis.service'
import { isProduction } from '../config/secrets'
import { HealthResponseDto } from '../dto/misc-response.dto'

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private redis: RedisService) {}

  @ApiOperation({
    summary: '서버 상태 확인하기',
    description:
      '서버가 잘 떠 있는지, Redis에 붙어 있는지 알려줘요. 로그인 없이 부를 수 있고 요청 수 제한도 없어요.\n\n' +
      '배포 후 헬스 체크나 로드 밸런서 점검에 쓰세요. 운영 환경에서는 `ok`만 알려줘요. 그 외 환경에서는 `service`, `redis`도 함께 줘요.',
  })
  @ApiOkResponse({
    description:
      '운영: `{ ok }`. 비운영: `{ ok: true, service, redis }`. `ok`/`redis`는 Redis ping 결과예요.',
    type: HealthResponseDto,
  })
  @Get('health')
  @SkipThrottle()
  async health() {
    const redis = await this.redis.ping()
    if (isProduction()) return { ok: redis }
    return { ok: true, service: 'erd-studio-api', redis }
  }
}
