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
import { Auth, OptionalAuth } from '../common/auth/decorators'
import { CurrentUser, type AuthUser } from '../common/auth/current-user'
import { ProjectListQueryDto } from '../dto/list-query.dto'
import {
  CreateProjectDto,
  InviteMemberDto,
  SnapshotDto,
  UpdateMemberDto,
  UpdateProjectDto,
  VersionDto,
} from '../dto/projects.dto'
import { ProjectsService } from '../services/projects.service'

const NOT_FOUND =
  '프로젝트를 찾을 수 없어요. 볼 권한이 없을 때도 같은 응답을 줘요.'

const ProjectId = () =>
  ApiParam({
    name: 'id',
    description: '프로젝트 ID예요.',
    example: 'clz9k2p4x0001s601abcdefgh',
  })

const VersionId = () =>
  ApiParam({
    name: 'versionId',
    description: '버전 ID예요.',
    example: 'clz9k2p4x0003s601qrstuvwx',
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

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private projects: ProjectsService) {}

  @ApiOperation({
    summary: '공유 링크로 다이어그램 보기',
    description:
      '공유 링크에 담긴 토큰으로 다이어그램을 읽기 전용으로 봐요. 로그인은 필요 없어요.\n\n' +
      '소유자가 공개를 꺼 두면 링크를 알아도 볼 수 없어요.',
  })
  @ApiParam({
    name: 'token',
    description: '프로젝트 설정에서 만든 공유 토큰이에요.',
    example: 'clz9k2p4x0002s601ijklmnop',
  })
  @ApiOkResponse({ description: '읽기 전용 다이어그램이에요.' })
  @ApiNotFoundResponse({ description: '링크가 올바르지 않거나 공개된 다이어그램이 아니에요.' })
  @OptionalAuth()
  @Get('shared/:token')
  shared(@Param('token') token: string) {
    return this.projects.getByShareToken(token)
  }

  @ApiOperation({
    summary: '내 프로젝트 목록 보기',
    description:
      '내가 만들거나 초대받은 프로젝트를 최근 수정한 순으로 보여줘요. 검색어와 페이지로 좁힐 수 있어요.',
  })
  @ApiOkResponse({
    description: '프로젝트 목록이에요. `items`와 함께 전체 개수, 페이지 정보를 줘요.',
  })
  @Auth()
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ProjectListQueryDto) {
    return this.projects.list(user, query)
  }

  @ApiOperation({
    summary: '프로젝트 만들기',
    description:
      '새 프로젝트를 만들어요. 만든 사람이 소유자가 되고, 팀을 지정하면 팀 프로젝트가 돼요.\n\n' +
      '팀을 지정하지 않으면 나만의 팀을 하나 만들어서 담아 둬요.',
  })
  @ApiCreatedResponse({ description: '프로젝트를 만들었어요.' })
  @ApiForbiddenResponse({ description: '내가 속한 팀이 아니면 팀 프로젝트를 만들 수 없어요.' })
  @Auth()
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProjectDto) {
    return this.projects.create(user, dto.name, dto.teamId, dto.fromSample)
  }

  @ApiOperation({
    summary: '프로젝트 하나 보기',
    description:
      '다이어그램과 팀원을 함께 가져와요. 공개된 프로젝트는 로그인 없이도 볼 수 있어요.',
  })
  @ProjectId()
  @ApiOkResponse({ description: '프로젝트 상세 정보예요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @OptionalAuth()
  @Get(':id')
  get(@CurrentUser() user: AuthUser | undefined, @Param('id') id: string) {
    return this.projects.get(user, id)
  }

  @ApiOperation({
    summary: '프로젝트 정보 수정하기',
    description:
      '이름, 설명, 태그를 바꿔요. 보낸 항목만 반영하니 바꾸고 싶은 것만 담으면 돼요.\n\n' +
      '공개 여부(`isPublic`)는 소유자만 바꿀 수 있어요.',
  })
  @ProjectId()
  @ApiOkResponse({ description: '수정한 프로젝트 정보예요.' })
  @ApiForbiddenResponse({ description: '편집 권한이 없거나, 공개 설정은 소유자만 바꿀 수 있어요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Auth()
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projects.updateMeta(user, id, dto)
  }

  @ApiOperation({
    summary: '다이어그램 저장하기',
    description:
      '지금 화면의 다이어그램을 서버에 저장해요. 실시간 편집 중에는 협업 서버가 알아서 저장하니, 혼자 편집할 때 주로 써요.',
  })
  @ProjectId()
  @ApiCreatedResponse({ description: '저장했어요.' })
  @ApiForbiddenResponse({ description: '편집 권한이 없어요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Auth()
  @Post(':id/snapshot')
  save(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SnapshotDto,
  ) {
    return this.projects.saveSnapshot(user, id, dto.snapshot)
  }

  @ApiOperation({
    summary: '프로젝트에서 나가기',
    description:
      '초대받은 프로젝트에서 스스로 빠져요. 소유자는 나갈 수 없고, 프로젝트를 삭제해야 해요.\n\n' +
      '팀을 통해 들어온 프로젝트라면 여기서 나갈 수 없어요. 팀에서 나가 주세요.',
  })
  @ProjectId()
  @ApiOkResponse({ description: '프로젝트에서 나왔어요.' })
  @ApiForbiddenResponse({
    description: '소유자이거나, 팀을 통해 들어와서 여기서는 나갈 수 없어요.',
  })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Auth()
  @Delete(':id/leave')
  leave(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.leave(user, id)
  }

  @ApiOperation({
    summary: '프로젝트 삭제하기',
    description:
      '프로젝트를 지워요. 다이어그램, 버전, 대화가 함께 사라지고 되돌릴 수 없어요.',
  })
  @ProjectId()
  @ApiOkResponse({ description: '프로젝트를 지웠어요.' })
  @ApiForbiddenResponse({ description: '삭제할 권한이 없어요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Auth()
  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.remove(user, id)
  }

  @ApiOperation({
    summary: '버전 보기',
    description: '저장해 둔 버전 목록을 최근 순으로 보여줘요. 다이어그램 내용은 빼고 요약만 줘요.',
  })
  @ProjectId()
  @ApiOkResponse({ description: '버전 목록이에요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Auth()
  @Get(':id/versions')
  versions(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.versions(user, id)
  }

  @ApiOperation({
    summary: '지금 상태를 버전으로 남기기',
    description:
      '되돌아올 수 있게 지금 다이어그램을 버전으로 저장해요. 이름을 붙여 두면 나중에 찾기 쉬워요.',
  })
  @ProjectId()
  @ApiCreatedResponse({ description: '버전을 남겼어요.' })
  @ApiForbiddenResponse({ description: '편집 권한이 없어요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Auth()
  @Post(':id/versions')
  snapshotVersion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: VersionDto,
  ) {
    return this.projects.snapshotVersion(user, id, dto.label, dto.document)
  }

  @ApiOperation({
    summary: '버전 하나 보기',
    description: '그 시점의 다이어그램을 그대로 가져와요. 되돌리기 전에 미리 볼 때 써요.',
  })
  @ProjectId()
  @VersionId()
  @ApiOkResponse({ description: '그 시점의 다이어그램이에요.' })
  @ApiNotFoundResponse({ description: '버전을 찾을 수 없어요.' })
  @Auth()
  @Get(':id/versions/:versionId')
  getVersion(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.projects.getVersion(user, id, versionId)
  }

  @ApiOperation({
    summary: '이 버전으로 되돌리기',
    description:
      '고른 버전으로 다이어그램을 되돌려요. 되돌리기 전 상태도 버전으로 남겨 두니 안심하고 눌러도 돼요.\n\n' +
      '같이 편집 중인 사람들 화면에도 바로 반영돼요.',
  })
  @ProjectId()
  @VersionId()
  @ApiCreatedResponse({ description: '되돌렸어요.' })
  @ApiForbiddenResponse({ description: '편집 권한이 없어요.' })
  @ApiNotFoundResponse({ description: '버전을 찾을 수 없어요.' })
  @Auth()
  @Post(':id/versions/:versionId/restore')
  restore(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.projects.restoreVersion(user, id, versionId)
  }

  @ApiOperation({
    summary: '팀원과 초대 현황 보기',
    description:
      '지금 함께 보는 사람과, 아직 수락하지 않은 초대를 함께 보여줘요.\n\n' +
      '팀 프로젝트라면 팀원이 그대로 들어가요.',
  })
  @ProjectId()
  @ApiOkResponse({ description: '팀원과 대기 중인 초대 목록이에요.' })
  @ApiForbiddenResponse({ description: '이 프로젝트의 팀원만 볼 수 있어요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Auth()
  @Get(':id/members')
  members(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.projects.listMembers(user, id)
  }

  @ApiOperation({
    summary: '팀원 초대하기',
    description:
      '이메일로 프로젝트에 초대해요. 받은 사람이 수락해야 들어와요. 아직 가입하지 않은 사람도 초대해 둘 수 있어요.\n\n' +
      '팀 프로젝트의 팀원은 팀에서 관리하니 이 API를 쓸 수 없어요.',
  })
  @ProjectId()
  @ApiCreatedResponse({
    description: '초대 메일을 보내고 `status: "invited"`를 줘요.',
  })
  @ApiBadRequestResponse({ description: '자기 자신은 초대할 수 없어요.' })
  @ApiForbiddenResponse({
    description:
      '팀원을 관리할 권한이 없거나, 팀 프로젝트라 팀에서 관리해야 해요. 이미 소유자인 사람도 초대할 수 없어요.',
  })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Auth()
  @Post(':id/members')
  addMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.projects.addMember(user, id, dto.email, dto.role)
  }

  @ApiOperation({
    summary: '초대 메일 다시 보내기',
    description: '아직 수락하지 않은 초대에 메일을 한 번 더 보내요.',
  })
  @ProjectId()
  @InviteId()
  @ApiCreatedResponse({ description: '초대 메일을 다시 보냈어요.' })
  @ApiForbiddenResponse({ description: '팀원을 관리할 권한이 없어요.' })
  @ApiNotFoundResponse({ description: '대기 중인 초대가 없어요.' })
  @Auth()
  @Post(':id/invitations/:inviteId/resend')
  resendInvite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.projects.resendInvite(user, id, inviteId)
  }

  @ApiOperation({
    summary: '초대 취소하기',
    description: '보낸 초대를 취소해요. 이미 받은 링크는 더 이상 쓸 수 없어요.',
  })
  @ProjectId()
  @InviteId()
  @ApiOkResponse({ description: '초대를 취소했어요.' })
  @ApiForbiddenResponse({ description: '팀원을 관리할 권한이 없어요.' })
  @ApiNotFoundResponse({ description: '대기 중인 초대가 없어요.' })
  @Auth()
  @Delete(':id/invitations/:inviteId')
  revokeInvite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.projects.revokeInvite(user, id, inviteId)
  }

  @ApiOperation({
    summary: '팀원 권한 바꾸기',
    description:
      '팀원을 편집자나 보기 전용으로 바꿔요. 소유자 권한은 바꿀 수 없어요.\n\n' +
      '보기 전용으로 바꾸면 편집 중이던 연결은 바로 읽기 모드가 돼요.',
  })
  @ProjectId()
  @MemberId()
  @ApiOkResponse({ description: '권한을 바꿨어요.' })
  @ApiForbiddenResponse({ description: '권한을 바꿀 수 없거나, 소유자 역할이에요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Auth()
  @Patch(':id/members/:userId')
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.projects.updateMember(user, id, userId, dto.role)
  }

  @ApiOperation({
    summary: '팀원 내보내기',
    description:
      '팀원을 프로젝트에서 내보내요. 편집 중이었다면 연결도 함께 끊어요. 소유자는 내보낼 수 없어요.',
  })
  @ProjectId()
  @MemberId()
  @ApiOkResponse({ description: '팀원을 내보냈어요.' })
  @ApiForbiddenResponse({ description: '권한이 없거나, 소유자는 내보낼 수 없어요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Auth()
  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.projects.removeMember(user, id, userId)
  }
}
