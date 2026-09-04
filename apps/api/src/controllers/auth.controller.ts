import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import type { Request, Response } from 'express'
import { AuthService, type SessionResult } from '../services/auth.service'
import { UsageService } from '../services/usage.service'
import {
  ChangePasswordDto,
  DeleteAccountDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  ResendVerificationDto,
  ResetPasswordDto,
  SessionResponseDto,
  VerifyEmailDto,
} from '../common/auth/dto'
import { Auth } from '../common/auth/decorators'
import { CurrentUser, type AuthUser } from '../common/auth/current-user'
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessExpiresSeconds,
  clearAuthCookies,
  readCookie,
  setAuthCookies,
} from '../common/auth/cookies'

const SESSION_DESCRIPTION =
  '로그인됐어요. `erd_access`, `erd_refresh` 쿠키를 함께 내려줘요.'

@ApiTags('auth')
@ApiTooManyRequestsResponse({
  description: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.',
})
@Controller('auth')
@Throttle({ default: { limit: 20, ttl: 60_000 } })
export class AuthController {
  constructor(
    private auth: AuthService,
    private usage: UsageService,
  ) {}

  @ApiOperation({
    summary: '회원가입하기',
    description:
      '계정을 만들고 인증 메일을 보내요. 아직 인증을 안 한 이메일로 다시 가입하면 정보만 새로 덮어써요.\n\n' +
      '이미 인증까지 마친 이메일이라면, 계정이 있다는 사실을 알려주지 않으려고 똑같은 응답을 돌려줘요.',
  })
  @ApiCreatedResponse({
    description:
      '인증 메일을 보냈어요. `mailed`가 `false`면 서버에 메일 설정이 없다는 뜻이에요.',
  })
  @ApiBadRequestResponse({
    description: '입력이 올바르지 않거나, 방금 보낸 메일이 있어서 조금 기다려야 해요.',
  })
  @Post('register')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto)
  }

  @ApiOperation({
    summary: '로그인하기',
    description:
      '이메일과 비밀번호로 로그인해요. 받아 둔 초대가 있으면 이때 자동으로 수락해요.',
  })
  @ApiCreatedResponse({
    description: SESSION_DESCRIPTION,
    type: SessionResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '이메일이나 비밀번호가 맞지 않아요.' })
  @ApiForbiddenResponse({
    description: '이메일 인증을 아직 안 했어요. 인증 메일을 다시 받아 주세요.',
  })
  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.login(dto)
    void this.usage.touch(session.user.id)
    return this.attachSession(res, session)
  }

  @ApiOperation({
    summary: '이메일 인증하기',
    description:
      '메일로 받은 토큰으로 이메일을 인증해요. 인증이 끝나면 바로 로그인까지 해 줘요.\n\n' +
      '가입할 때 `nextPath`를 넣었다면 응답으로 되돌려주니, 그 경로로 보내 주면 돼요.',
  })
  @ApiCreatedResponse({
    description: SESSION_DESCRIPTION,
    type: SessionResponseDto,
  })
  @ApiNotFoundResponse({ description: '인증 링크가 만료됐거나 올바르지 않아요.' })
  @Post('verify-email')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.verifyEmail(dto.token)
    void this.usage.touch(session.user.id)
    return this.attachSession(res, session)
  }

  @ApiOperation({
    summary: '인증 메일 다시 받기',
    description:
      '인증 메일을 다시 보내요. 계정이 있는지 알려주지 않으려고, 없는 이메일이어도 성공으로 답해요.\n\n' +
      '방금 보낸 메일이 있으면 1분 정도 기다려야 해요.',
  })
  @ApiCreatedResponse({ description: '보낼 수 있으면 보냈어요.' })
  @ApiBadRequestResponse({ description: '방금 보냈어요. 잠시 후 다시 시도해 주세요.' })
  @Post('resend-verification')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto.email)
  }

  @ApiOperation({
    summary: '액세스 토큰 새로 받기',
    description:
      '액세스 쿠키가 만료됐을 때 리프레시 토큰으로 새 세션을 받아요. 리프레시 토큰은 쓸 때마다 새로 바뀌어요.\n\n' +
      '보통은 `erd_refresh` 쿠키가 알아서 실려 가니 본문은 비워도 돼요.',
  })
  @ApiCreatedResponse({
    description: SESSION_DESCRIPTION,
    type: SessionResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: '리프레시 토큰이 없거나 만료됐어요. 다시 로그인해 주세요.',
  })
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Body() dto: RefreshTokenDto = {},
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = dto.refreshToken || readCookie(req, REFRESH_COOKIE)
    return this.attachSession(res, await this.auth.refresh(refreshToken))
  }

  @ApiOperation({
    summary: '로그아웃하기',
    description:
      '지금 쓰던 토큰을 못 쓰게 만들고 쿠키를 지워요. 이미 로그아웃된 상태여도 성공으로 답해요.',
  })
  @ApiCreatedResponse({ description: '로그아웃했어요. 인증 쿠키를 지워요.' })
  @Post('logout')
  async logout(
    @Body() dto: RefreshTokenDto = {},
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(
      readCookie(req, ACCESS_COOKIE),
      dto.refreshToken || readCookie(req, REFRESH_COOKIE),
    )
    clearAuthCookies(res)
    return { ok: true as const }
  }

  @ApiOperation({
    summary: '비밀번호 재설정 메일 받기',
    description:
      '비밀번호를 잊었을 때 재설정 링크를 메일로 보내요. 계정이 있는지 알려주지 않으려고 어떤 이메일이든 성공으로 답해요.',
  })
  @ApiCreatedResponse({ description: '보낼 수 있으면 보냈어요.' })
  @Post('forgot-password')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email)
  }

  @ApiOperation({
    summary: '비밀번호 재설정하기',
    description:
      '메일로 받은 토큰으로 새 비밀번호를 정해요. 바꾸면 모든 기기에서 로그아웃되고, 편집 중이던 연결도 끊어요.',
  })
  @ApiCreatedResponse({ description: '비밀번호를 바꿨어요. 다시 로그인해 주세요.' })
  @ApiNotFoundResponse({ description: '재설정 링크가 만료됐거나 올바르지 않아요.' })
  @Post('reset-password')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password)
  }

  @ApiOperation({
    summary: '비밀번호 바꾸기',
    description:
      '로그인한 상태에서 비밀번호를 바꿔요. 바꾸면 이 기기까지 모두 로그아웃되니 다시 로그인해 주세요.',
  })
  @ApiCreatedResponse({ description: '비밀번호를 바꿨어요. 인증 쿠키를 지워요.' })
  @ApiUnauthorizedResponse({ description: '현재 비밀번호가 맞지 않아요.' })
  @Post('change-password')
  @Auth()
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.changePassword(user, dto)
    clearAuthCookies(res)
    return result
  }

  @ApiOperation({
    summary: '계정 탈퇴하기',
    description:
      '로그인한 계정을 탈퇴해요. 비밀번호로 한 번 더 확인해요.\n\n' +
      '내가 만든 팀과 그 안의 프로젝트는 함께 사라지고, 다른 팀에서 남긴 대화도 지워요. 같은 이메일로 다시 가입할 수 있어요.\n\n' +
      '마지막 플랫폼 관리자는 탈퇴할 수 없어요.',
  })
  @ApiOkResponse({ description: '탈퇴했어요. 인증 쿠키를 지워요.' })
  @ApiUnauthorizedResponse({ description: '현재 비밀번호가 맞지 않아요.' })
  @ApiBadRequestResponse({ description: '마지막 관리자는 탈퇴할 수 없어요.' })
  @Post('delete-account')
  @Auth()
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.deleteAccount(user, dto)
    clearAuthCookies(res)
    return result
  }

  @ApiOperation({
    summary: '실시간 편집용 토큰 받기',
    description:
      '협업 서버(WebSocket)에 붙을 때 쓰는 2분짜리 토큰이에요.\n\n' +
      '웹과 협업 서버가 같은 도메인이면 쿠키로 바로 붙으니 이 API는 필요 없어요. 도메인이 다를 때만 써 주세요.',
  })
  @ApiOkResponse({ description: '토큰을 발급했어요. 2분 안에 연결해 주세요.' })
  @Get('ws-token')
  @Auth()
  wsToken(@CurrentUser() user: AuthUser) {
    return this.auth.collabToken(user)
  }

  @ApiOperation({
    summary: '내 정보 보기',
    description:
      '로그인한 사용자 정보와 액세스 토큰이 언제 만료되는지 알려줘요. 새로고침했을 때 로그인 상태를 확인하는 데 써요.\n\n' +
      '`user.isAdmin`이 true면 플랫폼 관리자라 `/admin`을 열 수 있어요.',
  })
  @ApiOkResponse({
    description: '내 정보와 만료 시각(밀리초)이에요.',
    type: SessionResponseDto,
  })
  @Get('me')
  @Auth()
  me(@CurrentUser() user: AuthUser) {
    return {
      user,
      expiresAt: Date.now() + accessExpiresSeconds() * 1000,
    }
  }

  private attachSession = (res: Response, session: SessionResult) => {
    setAuthCookies(res, session.token, session.refreshToken)
    return {
      user: session.user,
      expiresAt: session.expiresAt,
      nextPath: session.nextPath,
    }
  }
}
