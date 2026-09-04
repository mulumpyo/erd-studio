import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common'
import { tap } from 'rxjs'
import { UsageService } from '../services/usage.service'

const skipPath = (url: string) => {
  const path = url.split('?')[0]
  return path.endsWith('/health') || path.endsWith('/auth/refresh')
}

@Injectable()
export class UsageInterceptor implements NestInterceptor {
  constructor(private usage: UsageService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      tap(() => {
        const req = context.switchToHttp().getRequest<{
          originalUrl?: string
          url?: string
          user?: { id?: string }
        }>()
        const url = req.originalUrl || req.url || ''
        if (skipPath(url)) return
        const userId = req.user?.id
        if (userId) void this.usage.touch(userId)
      }),
    )
  }
}
