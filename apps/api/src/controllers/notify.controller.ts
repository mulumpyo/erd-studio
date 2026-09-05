import { Controller, Get, Req, Res } from '@nestjs/common'
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { Auth } from '../common/auth/decorators'
import { CurrentUser, type AuthUser } from '../common/auth/current-user'
import { NotifyService } from '../services/notify.service'

@ApiTags('notify')
@Controller()
@Auth()
export class NotifyController {
  constructor(private notify: NotifyService) {}

  @ApiOperation({
    summary: '알림 받기',
    description:
      '새 채팅이나 프로젝트 초대가 생기면 바로 알려 주는 연결이에요. 워크스페이스가 열려 있는 동안만 붙여 두고, 알림이 오면 목록을 다시 받으면 돼요.',
  })
  @ApiOkResponse({
    description:
      'SSE 연결이에요. `notify` 이벤트의 `type`이 `chat`이면 채팅, `invite`면 초대예요.',
  })
  @ApiProduces('text/event-stream')
  @SkipThrottle()
  @Get('notify/stream')
  stream(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.notify.watch(user, req, res)
  }
}
