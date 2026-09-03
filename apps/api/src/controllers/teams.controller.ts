import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import {
  ApiBadRequestResponse,
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
import {
  CreateTeamDto,
  InviteTeamMemberDto,
  UpdateTeamMemberDto,
} from '../dto/teams.dto'
import { ListQueryDto } from '../dto/list-query.dto'
import { TeamsService } from '../services/teams.service'

const NOT_FOUND = '팀을 찾을 수 없어요. 속한 팀이 아닐 때도 같은 응답을 줘요.'

const TeamId = () =>
  ApiParam({
    name: 'id',
    description: '팀 ID예요.',
    example: 'clz9k2p4x0001s601abcdefgh',
  })

const InviteId = () =>
  ApiParam({
    name: 'inviteId',
    description: '초대 ID예요.',
    example: 'clz9k2p4x0004s601yzabcdef',
  })

const MemberId = () =>
  ApiParam({
    name: 'userId',
    description: '대상 사용자 ID예요.',
    example: 'clz9k2p4x0005s601ghijklmn',
  })

@ApiTags('teams')
@Controller('teams')
@Auth()
export class TeamsController {
  constructor(private teams: TeamsService) {}

  @ApiOperation({
    summary: '내 팀 목록 보기',
    description:
      '내가 만들거나 속한 팀을 보여줘요. 팀마다 멤버와 프로젝트 개수를 함께 줘요.',
  })
  @ApiOkResponse({ description: '팀 목록이에요. 전체 개수와 페이지 정보도 함께 줘요.' })
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListQueryDto) {
    return this.teams.list(user, query)
  }

  @ApiOperation({
    summary: '팀 만들기',
    description: '새 팀을 만들어요. 만든 사람이 소유자가 돼요.',
  })
  @ApiCreatedResponse({ description: '팀을 만들었어요.' })
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTeamDto) {
    return this.teams.create(user, dto.name)
  }

  @ApiOperation({
    summary: '팀원 초대하기',
    description:
      '이메일로 팀에 초대해요. 아직 가입하지 않은 사람도 초대해 두면, 가입할 때 자동으로 들어와요.\n\n' +
      '팀에 들어오면 팀 프로젝트를 모두 볼 수 있게 되니 권한을 잘 골라 주세요.',
  })
  @TeamId()
  @ApiCreatedResponse({
    description:
      '이미 가입한 사람이면 바로 팀원으로 넣고 `status: "joined"`를 줘요. 아니면 초대 메일을 보내요.',
  })
  @ApiBadRequestResponse({ description: '자기 자신은 초대할 수 없어요.' })
  @ApiForbiddenResponse({
    description: '멤버를 관리할 권한이 없거나, 이미 소유자인 사람이에요.',
  })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Post(':id/members')
  invite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: InviteTeamMemberDto,
  ) {
    return this.teams.addMember(user, id, dto.email, dto.role)
  }

  @ApiOperation({
    summary: '초대 메일 다시 보내기',
    description: '아직 수락하지 않은 초대에 메일을 한 번 더 보내요.',
  })
  @TeamId()
  @InviteId()
  @ApiCreatedResponse({ description: '초대 메일을 다시 보냈어요.' })
  @ApiForbiddenResponse({ description: '멤버를 관리할 권한이 없어요.' })
  @ApiNotFoundResponse({ description: '대기 중인 초대가 없어요.' })
  @Post(':id/invitations/:inviteId/resend')
  resendInvite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.teams.resendInvite(user, id, inviteId)
  }

  @ApiOperation({
    summary: '초대 취소하기',
    description: '보낸 초대를 취소해요. 이미 받은 링크는 더 이상 쓸 수 없어요.',
  })
  @TeamId()
  @InviteId()
  @ApiOkResponse({ description: '초대를 취소했어요.' })
  @ApiForbiddenResponse({ description: '멤버를 관리할 권한이 없어요.' })
  @ApiNotFoundResponse({ description: '대기 중인 초대가 없어요.' })
  @Delete(':id/invitations/:inviteId')
  revokeInvite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.teams.revokeInvite(user, id, inviteId)
  }

  @ApiOperation({
    summary: '팀에서 나가기',
    description:
      '팀에서 스스로 빠져요. 팀 프로젝트도 더 이상 볼 수 없어요. 소유자는 나갈 수 없어요.',
  })
  @TeamId()
  @ApiOkResponse({ description: '팀에서 나왔어요.' })
  @ApiForbiddenResponse({ description: '소유자는 나갈 수 없어요. 팀을 삭제해 주세요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Delete(':id/leave')
  leave(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.teams.leave(user, id)
  }

  @ApiOperation({
    summary: '팀 삭제하기',
    description:
      '빈 팀을 지워요. 소유자만 할 수 있고, 팀에 프로젝트가 남아 있으면 지울 수 없어요.\n\n' +
      '프로젝트를 먼저 정리한 다음에 다시 시도해 주세요.',
  })
  @TeamId()
  @ApiOkResponse({ description: '팀을 지웠어요.' })
  @ApiBadRequestResponse({
    description: '팀에 프로젝트가 남아 있어요. 프로젝트를 먼저 삭제해 주세요.',
  })
  @ApiForbiddenResponse({ description: '소유자만 팀을 지울 수 있어요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.teams.remove(user, id)
  }

  @ApiOperation({
    summary: '팀원 권한 바꾸기',
    description:
      '팀원을 편집자나 보기 전용으로 바꿔요. 팀 프로젝트 전체에 바로 반영돼요. 소유자 권한은 바꿀 수 없어요.',
  })
  @TeamId()
  @MemberId()
  @ApiOkResponse({ description: '권한을 바꿨어요.' })
  @ApiForbiddenResponse({ description: '권한을 바꿀 수 없거나, 소유자 역할이에요.' })
  @ApiNotFoundResponse({ description: '팀 멤버가 아니에요.' })
  @Patch(':id/members/:userId')
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    return this.teams.updateMember(user, id, userId, dto.role)
  }

  @ApiOperation({
    summary: '팀원 내보내기',
    description:
      '팀원을 내보내요. 팀 프로젝트를 편집 중이었다면 연결도 함께 끊어요. 소유자는 내보낼 수 없어요.',
  })
  @TeamId()
  @MemberId()
  @ApiOkResponse({ description: '팀원을 내보냈어요.' })
  @ApiForbiddenResponse({ description: '권한이 없거나, 소유자는 내보낼 수 없어요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.teams.removeMember(user, id, userId)
  }
}
