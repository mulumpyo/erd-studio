import { Controller, Get, Req, Res } from '@nestjs/common'
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { Auth } from '../common/auth/decorators'
import { CurrentUser, type AuthUser } from '../common/auth/current-user'
import { NotifyService } from '../services/notify.service'
import {
  NotifyChatEventDto,
  NotifyInviteEventDto,
  NotifyProjectEventDto,
  NotifyTeamEventDto,
  NOTIFY_SSE_DESCRIPTION,
} from '../dto/misc-response.dto'
@ApiTags('notify')
@ApiExtraModels(
  NotifyChatEventDto,
  NotifyInviteEventDto,
  NotifyTeamEventDto,
  NotifyProjectEventDto,
)
@Controller()
@Auth()
export class NotifyController {
  constructor(private notify: NotifyService) {}

  @ApiOperation({
    summary: '알림 받기',
    description:
      '채팅·초대·팀·프로젝트 변경을 바로 알려 주는 연결이에요. 워크스페이스가 열려 있는 동안만 붙여 두세요.',
  })
  @ApiOkResponse({
    description: NOTIFY_SSE_DESCRIPTION,
    schema: {
      oneOf: [
        { $ref: getSchemaPath(NotifyChatEventDto) },
        { $ref: getSchemaPath(NotifyInviteEventDto) },
        { $ref: getSchemaPath(NotifyTeamEventDto) },
        { $ref: getSchemaPath(NotifyProjectEventDto) },
      ],
    },
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
