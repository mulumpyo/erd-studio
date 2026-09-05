import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'
import { Auth } from '../common/auth/decorators'
import { CurrentUser, type AuthUser } from '../common/auth/current-user'
import { ChatDto } from '../dto/chat.dto'
import { ChatService } from '../services/chat.service'

const NOT_FOUND =
  '프로젝트를 찾을 수 없어요. 볼 권한이 없을 때도 같은 응답을 줘요.'

const parseInboxSeen = (raw?: string): Record<string, number> => {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [key, value] of Object.entries(parsed)) {
      const at = typeof value === 'number' ? value : Number(value)
      if (key && Number.isFinite(at)) out[key] = at
    }
    return out
  } catch {
    return {}
  }
}

const ProjectId = () =>
  ApiParam({
    name: 'id',
    description: '프로젝트 ID예요.',
    example: 'clz9k2p4x0001s601abcdefgh',
  })

@ApiTags('chat')
@Controller()
@Auth()
export class ChatController {
  constructor(private chat: ChatService) {}

  @ApiOperation({
    summary: '채팅 알림 보기',
    description:
      '내가 볼 수 있는 프로젝트의 마지막 메시지를 모아서 줘요. 프로젝트마다 내가 안 읽은 메시지 개수도 함께 줘요.',
  })
  @ApiOkResponse({
    description: '프로젝트별 마지막 메시지와 안 읽은 개수 목록이에요.',
  })
  @Get('chat/inbox')
  inbox(
    @CurrentUser() user: AuthUser,
    @Query('seen') seen?: string,
  ) {
    return this.chat.inbox(user, parseInboxSeen(seen))
  }

  @ApiOperation({
    summary: '대화 보기',
    description:
      '프로젝트 안에서 주고받은 메시지를 오래된 순으로 보여줘요. 프로젝트 팀원만 볼 수 있어요.',
  })
  @ApiOkResponse({
    description: '메시지를 최대 200개까지 줘요. 보낸 사람 정보도 함께 담겨요.',
  })
  @ApiForbiddenResponse({ description: '이 프로젝트의 팀원만 볼 수 있어요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @ProjectId()
  @Get('projects/:id/chat')
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.list(user, id)
  }

  @ApiOperation({
    summary: '메시지 보내기',
    description:
      '프로젝트 팀원에게 메시지를 남겨요. 편집 권한이 있어야 보낼 수 있고, 보기 전용 팀원은 읽기만 돼요.',
  })
  @ApiCreatedResponse({ description: '보낸 메시지예요.' })
  @ApiForbiddenResponse({ description: '편집 권한이 없어요. 보기 전용 팀원은 읽기만 돼요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @ProjectId()
  @Post('projects/:id/chat')
  send(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ChatDto,
  ) {
    return this.chat.send(user, id, dto.body)
  }
}
