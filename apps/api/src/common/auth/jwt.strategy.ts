import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import type { Request } from 'express'
import { PrismaService } from '../../services/prisma.service'
import { AccessTokenService } from '../../services/access-token.service'
import { requireJwtSecret } from '../../config/secrets'
import { ACCESS_COOKIE, readCookie } from './cookies'
import type { JwtPayload } from './jwt-payload'

export type { JwtPayload } from './jwt-payload'

const fromCookieOrBearer = (req: Request) =>
  readCookie(req, ACCESS_COOKIE) ||
  ExtractJwt.fromAuthHeaderAsBearerToken()(req)

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private accessTokens: AccessTokenService,
  ) {
    super({
      jwtFromRequest: fromCookieOrBearer,
      secretOrKey: requireJwtSecret(),
      ignoreExpiration: false,
      algorithms: ['HS256'],
    })
  }

  validate = async (payload: JwtPayload) => {
    if (payload.typ && payload.typ !== 'access') {
      throw new UnauthorizedException()
    }
    if (await this.accessTokens.isDenied(payload.jti)) {
      throw new UnauthorizedException()
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    })
    if (!user?.emailVerifiedAt || user.deletedAt) throw new UnauthorizedException()
    if (user.suspendedAt) throw new UnauthorizedException()
    const revokedSec = user.tokenRevokedAt
      ? Math.floor(user.tokenRevokedAt.getTime() / 1000)
      : 0
    if (payload.iat && revokedSec && payload.iat < revokedSec) {
      throw new UnauthorizedException()
    }
    return { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin }
  }
}
