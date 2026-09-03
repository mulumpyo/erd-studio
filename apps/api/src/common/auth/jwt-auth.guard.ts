import { ExecutionContext, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ACCESS_COOKIE, readCookie } from './cookies'

const hasAccessToken = (req: {
  headers?: { authorization?: string; cookie?: string }
  cookies?: Record<string, string>
}) =>
  Boolean(req.headers?.authorization || readCookie(req, ACCESS_COOKIE))

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest()
    if (!hasAccessToken(req)) return true
    return super.canActivate(context)
  }

  handleRequest<TUser>(err: Error | null, user: TUser) {
    if (err || !user) return null as TUser
    return user
  }
}
