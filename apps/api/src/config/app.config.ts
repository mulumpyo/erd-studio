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

/** nginx가 같은 호스트 루프백에서만 붙는 전제예요. 공개망 헤더는 믿지 않아요. */
export const EXPRESS_TRUST_PROXY = 'loopback'

export const applyAppConfig = (app: INestApplication) => {
  const http = app.getHttpAdapter().getInstance() as { set?: (key: string, value: string) => void }
  http.set?.('trust proxy', EXPRESS_TRUST_PROXY)
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
