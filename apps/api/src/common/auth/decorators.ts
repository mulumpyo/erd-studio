import { applyDecorators, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import { BEARER_AUTH, COOKIE_AUTH } from '../../config/openapi.config'
import { JwtAuthGuard, OptionalJwtAuthGuard } from './jwt-auth.guard'

export const Auth = () =>
  applyDecorators(
    UseGuards(JwtAuthGuard),
    ApiCookieAuth(COOKIE_AUTH),
    ApiBearerAuth(BEARER_AUTH),
    ApiUnauthorizedResponse({
      description: '로그인이 필요해요. 쿠키가 만료됐다면 먼저 토큰을 새로 받아 주세요.',
    }),
    ApiTooManyRequestsResponse({
      description: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.',
    }),
  )

/** 로그인해도, 안 해도 쓸 수 있어요. 로그인한 만큼만 더 보여줘요. */
export const OptionalAuth = () =>
  applyDecorators(
    UseGuards(OptionalJwtAuthGuard),
    ApiCookieAuth(COOKIE_AUTH),
    ApiBearerAuth(BEARER_AUTH),
    ApiTooManyRequestsResponse({
      description: '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.',
    }),
  )
