import { ValidationPipe, type INestApplication } from '@nestjs/common'
import { isAllowedBrowserOrigin } from '../common/urls'

const stripSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '')

export const appConfig = {
  port: () => Number(process.env.API_PORT ?? 3000),
  prefix: () => {
    if (process.env.API_PREFIX !== undefined) {
      return stripSlashes(process.env.API_PREFIX)
    }
    return process.env.NODE_ENV === 'production' ? 'api' : ''
  },
  path: (segment: string) => {
    const prefix = appConfig.prefix()
    const rest = stripSlashes(segment)
    return prefix ? `/${prefix}/${rest}` : `/${rest}`
  },
}

export const applyAppConfig = (app: INestApplication) => {
  const prefix = appConfig.prefix()
  if (prefix) app.setGlobalPrefix(prefix)
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean | string) => void,
    ) => {
      if (!origin) {
        callback(null, true)
        return
      }
      callback(null, isAllowedBrowserOrigin(origin) ? origin : false)
    },
    credentials: true,
  })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
}
