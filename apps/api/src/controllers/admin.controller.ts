import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'
import { Auth } from '../common/auth/decorators'
import { CurrentUser, type AuthUser } from '../common/auth/current-user'
import { assertAdmin } from '../common/access'
import { AdminUserQueryDto, AddAdminDto, SuspendUserDto, UpdateAdminDto } from '../dto/admin.dto'
import { UsageQueryDto } from '../dto/usage.dto'
import { AdminService } from '../services/admin.service'
import { UsageService } from '../services/usage.service'
import { shiftUsageDay, usageDayKey } from '@erd-studio/shared'

const NOT_FOUND = '찾을 수 없어요. 관리자가 아닐 때도 같은 응답을 줘요.'

const UserId = () =>
  ApiParam({
    name: 'id',
    description: '대상 사용자 ID예요.',
    example: 'clz9k2p4x0005s601ghijklmn',
  })

@ApiTags('admin')
@Controller('admin')
@Auth()
export class AdminController {
  constructor(
    private admin: AdminService,
    private usage: UsageService,
  ) {}

  @ApiOperation({
    summary: '운영 요약 보기',
    description:
      '총 가입자, 오늘 가입·인증·탈퇴, 오늘 DAU·WAU·MAU와 최근 30일 추이를 줘요. DAU·WAU·MAU에서는 플랫폼 관리자를 빼요. 총 가입자는 탈퇴하지 않은 계정만 세요. 관리자만 볼 수 있어요.',
  })
  @ApiOkResponse({ description: '오늘 기준 운영 숫자예요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    assertAdmin(user)
    return this.admin.overview()
  }

  @ApiOperation({
    summary: '사용량 보기',
    description:
      '로그인한 사람 기준으로 DAU·WAU·MAU를 한국 날짜로 잘라 보여줘요. 플랫폼 관리자(`isAdmin`)는 기록은 남기고 이 숫자에서는 빼요.\n\n' +
      '- **DAU**: 그날 워크스페이스나 에디터를 쓴 사람 수예요.\n' +
      '- **WAU**: 그날 포함 최근 7일 동안 한 번이라도 쓴 사람 수예요.\n' +
      '- **MAU**: 그날 포함 최근 30일 동안 한 번이라도 쓴 사람 수예요.',
  })
  @ApiOkResponse({
    description: '날짜별 DAU·WAU·MAU예요. 시간대는 Asia/Seoul이에요.',
  })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Get('usage')
  usageSeries(@CurrentUser() user: AuthUser, @Query() query: UsageQueryDto) {
    assertAdmin(user)
    const to = query.to || usageDayKey()
    const from = query.from || shiftUsageDay(to, -29)
    return this.usage.series(from, to)
  }

  @ApiOperation({
    summary: '사용자 목록 보기',
    description: '가입한 사용자를 최근 가입 순으로 보여줘요. 이름·이메일로 찾을 수 있고, 관리자 계정은 빼요.',
  })
  @ApiOkResponse({ description: '사용자 목록과 페이지 정보예요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @Get('users')
  users(@CurrentUser() user: AuthUser, @Query() query: AdminUserQueryDto) {
    assertAdmin(user)
    return this.admin.listUsers(query)
  }

  @ApiOperation({
    summary: '관리자 올리기',
    description:
      '이미 가입하고 이메일 인증까지 끝난 계정을 관리자로 올려요. 없는 이메일이면 찾아볼 수 없다고 답해요.',
  })
  @ApiOkResponse({ description: '관리자로 올린 계정이에요.' })
  @ApiNotFoundResponse({
    description: '인증된 계정을 찾을 수 없어요. 관리자가 아닐 때도 같은 응답을 줘요.',
  })
  @Post('admins')
  addAdmin(@CurrentUser() user: AuthUser, @Body() dto: AddAdminDto) {
    assertAdmin(user)
    return this.admin.addAdmin(dto.email)
  }

  @ApiOperation({
    summary: '관리자 여부 바꾸기',
    description:
      '사용자를 관리자로 올리거나 내려요. 마지막 관리자와 초기 관리자(`INITIAL_ADMIN_EMAIL`)는 내릴 수 없어요.',
  })
  @ApiOkResponse({ description: '바꾼 계정이에요.' })
  @ApiBadRequestResponse({
    description: '마지막 관리자이거나 인증 전 계정이면 바꿀 수 없어요.',
  })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @UserId()
  @Patch('users/:id')
  setAdmin(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateAdminDto,
  ) {
    assertAdmin(user)
    return this.admin.setAdmin(id, dto.isAdmin)
  }

  @ApiOperation({
    summary: '비밀번호 재설정 메일 보내기',
    description:
      '사용자에게 비밀번호 재설정 메일을 보내요. 관리자 계정에는 보낼 수 없어요.',
  })
  @ApiOkResponse({ description: '메일을 보냈어요. 서버에 메일 설정이 없으면 mailed가 false예요.' })
  @ApiBadRequestResponse({ description: '인증 전 계정이거나, 방금 보낸 메일이 있어요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @UserId()
  @Post('users/:id/password-reset')
  sendPasswordReset(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertAdmin(user)
    return this.admin.sendPasswordReset(id)
  }

  @ApiOperation({
    summary: '계정 정지 바꾸기',
    description:
      '계정을 정지하거나 풀어 줘요. 정지된 계정은 로그인과 편집을 할 수 없어요. 관리자 계정은 정지할 수 없어요.',
  })
  @ApiOkResponse({ description: '바꾼 계정이에요.' })
  @ApiNotFoundResponse({ description: NOT_FOUND })
  @UserId()
  @Patch('users/:id/suspension')
  setSuspended(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SuspendUserDto,
  ) {
    assertAdmin(user)
    return this.admin.setSuspended(id, dto.suspended)
  }
}
