import { Body, Controller, Get, Param, Post } from '@nestjs/common'
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
      '내가 볼 수 있는 프로젝트의 마지막 메시지를 모아서 줘요. 워크스페이스에서 새 대화를 확인할 때 써요.',
  })
  @ApiOkResponse({
    description: '프로젝트별 마지막 메시지 목록이에요.',
  })
  @Get('chat/inbox')
  inbox(@CurrentUser() user: AuthUser) {
    return this.chat.inbox(user)
  }

  @ApiOperation({
    summary: '대화 보기',
    description:
      '프로젝트 안에서 주고받은 메시지를 오래된 순으로 보여줘요. 프로젝트 멤버만 볼 수 있어요.',
  })
  @ApiOkResponse({
    description: '메시지를 최대 200개까지 줘요. 보낸 사람 정보도 함께 담겨요.',
  })
  @ApiForbiddenResponse({ description: '이 프로젝트의 멤버만 볼 수 있어요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @ProjectId()
  @Get('projects/:id/chat')
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.chat.list(user, id)
  }

  @ApiOperation({
    summary: '메시지 보내기',
    description:
      '프로젝트 팀원에게 메시지를 남겨요. 편집 권한이 있어야 보낼 수 있고, 보기 전용 멤버는 읽기만 돼요.',
  })
  @ApiCreatedResponse({ description: '보낸 메시지예요.' })
  @ApiForbiddenResponse({ description: '편집 권한이 없어요. 보기 전용 멤버는 읽기만 돼요.' })
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
