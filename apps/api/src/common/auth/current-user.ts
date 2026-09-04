import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export type AuthUser = {
  id: string
  email: string
  name: string
  isAdmin?: boolean
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest()
    return req.user
  },
)
