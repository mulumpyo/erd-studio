import { Controller, Get, Param, Post } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { Auth } from '../common/auth/decorators'
import { CurrentUser, type AuthUser } from '../common/auth/current-user'
import { InvitationsService } from '../services/invitations.service'

@ApiTags('invites')
@ApiTooManyRequestsResponse({
  description: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.',
})
@Controller('invites')
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class InvitationsController {
  constructor(private invitations: InvitationsService) {}

  @ApiOperation({
    summary: '받은 초대 보기',
    description:
      '내가 받은 대기 중 초대와, 내가 보낸 초대를 상대가 수락하거나 거절한 알림을 줘요.',
  })
  @ApiOkResponse({ description: '받은 초대 목록이에요.' })
  @Auth()
  @Get()
  listMine(@CurrentUser() user: AuthUser) {
    return this.invitations.listMine(user)
  }

  @ApiOperation({
    summary: '받은 초대 수락하기',
    description: '워크스페이스에 보이는 프로젝트 초대를 수락해서 들어가요.',
  })
  @ApiParam({ name: 'id', description: '초대 ID예요.' })
  @ApiCreatedResponse({
    description: '수락했어요. 들어간 곳의 `projectId`를 줘요.',
  })
  @ApiBadRequestResponse({ description: '초대가 만료됐거나 이미 끝난 초대예요.' })
  @ApiNotFoundResponse({ description: '초대를 찾을 수 없어요.' })
  @Auth()
  @Post('received/:id/accept')
  acceptReceived(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invitations.acceptReceived(user, id)
  }

  @ApiOperation({
    summary: '받은 초대 거절하기',
    description: '워크스페이스에 보이는 프로젝트 초대를 거절해요.',
  })
  @ApiParam({ name: 'id', description: '초대 ID예요.' })
  @ApiCreatedResponse({ description: '거절했어요.' })
  @ApiBadRequestResponse({ description: '초대가 만료됐거나 이미 끝난 초대예요.' })
  @ApiNotFoundResponse({ description: '초대를 찾을 수 없어요.' })
  @Auth()
  @Post('received/:id/decline')
  declineReceived(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invitations.declineReceived(user, id)
  }

  @ApiOperation({
    summary: '거절 알림 닫기',
    description: '내가 보낸 초대를 상대가 수락하거나 거절했을 때 오는 알림을 닫아요.',
  })
  @ApiParam({ name: 'id', description: '초대 ID예요.' })
  @ApiCreatedResponse({ description: '알림을 닫았어요.' })
  @ApiNotFoundResponse({ description: '초대를 찾을 수 없어요.' })
  @Auth()
  @Post('sent/:id/dismiss')
  dismissDeclined(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.invitations.dismissDeclined(user, id)
  }

  @ApiOperation({
    summary: '초대 내용 미리 보기',
    description:
      '초대 링크를 누르면 어디에 초대됐는지 먼저 보여줘요. 로그인 전에도 볼 수 있어요.\n\n' +
      '아직 가입하지 않았다면 이 정보로 가입 화면을 채워 주면 돼요.',
  })
  @ApiParam({
    name: 'token',
    description: '초대 메일 링크에 담긴 토큰이에요.',
    example: 'Zx8Z1t0pV9xK7mB2nR8yZ4wL6cJ5hD0a',
  })
  @ApiOkResponse({
    description:
      '초대한 사람, 초대된 곳, 받게 될 권한과 만료 시각이에요. `status`로 아직 유효한지 알 수 있어요.',
  })
  @ApiNotFoundResponse({ description: '초대를 찾을 수 없어요.' })
  @Get(':token')
  preview(@Param('token') token: string) {
    return this.invitations.preview(token)
  }

  @ApiOperation({
    summary: '초대 수락하기',
    description:
      '초대를 수락해서 팀이나 프로젝트에 들어가요. 초대받은 이메일과 같은 계정으로 로그인해야 해요.\n\n' +
      '팀·프로젝트 초대 모두 직접 수락해야 해요.',
  })
  @ApiParam({
    name: 'token',
    description: '초대 메일 링크에 담긴 토큰이에요.',
  })
  @ApiCreatedResponse({
    description: '수락했어요. 들어간 곳의 `teamId` 또는 `projectId`를 줘요.',
  })
  @ApiBadRequestResponse({
    description: '초대가 만료됐거나 이미 거절한 초대예요.',
  })
  @ApiForbiddenResponse({ description: '초대받은 계정으로 로그인한 뒤 수락해 주세요.' })
  @ApiNotFoundResponse({ description: '초대를 찾을 수 없어요.' })
  @Auth()
  @Post(':token/accept')
  accept(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.invitations.accept(user, token)
  }

  @ApiOperation({
    summary: '초대 거절하기',
    description:
      '메일 링크로 받은 초대를 거절해요. 로그인하지 않아도 링크만 있으면 거절할 수 있어요.',
  })
  @ApiParam({
    name: 'token',
    description: '초대 메일 링크에 담긴 토큰이에요.',
  })
  @ApiCreatedResponse({ description: '거절했어요.' })
  @ApiBadRequestResponse({
    description: '초대가 만료됐거나 이미 수락한 초대예요.',
  })
  @ApiNotFoundResponse({ description: '초대를 찾을 수 없어요.' })
  @Post(':token/decline')
  decline(@Param('token') token: string) {
    return this.invitations.decline(token)
  }
}
