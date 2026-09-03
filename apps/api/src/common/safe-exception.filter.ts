import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import type { Response } from 'express'
import { isProduction } from '../config/secrets'

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>()
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      res.status(status).json(
        typeof body === 'string' ? { statusCode: status, message: body } : body,
      )
      return
    }
    const message = exception instanceof Error ? exception.message : 'unknown'
    console.error('[api]', message)
    const status = HttpStatus.INTERNAL_SERVER_ERROR
    res.status(status).json({
      statusCode: status,
      message: isProduction()
        ? '서버 오류가 발생했어요.'
        : exception instanceof Error
          ? exception.message
          : '서버 오류가 발생했어요.',
    })
  }
}
