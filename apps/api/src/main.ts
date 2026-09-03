import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'
import { AppModule } from './modules/app.module'
import { appConfig, applyAppConfig } from './config/app.config'
import { enableApiDocs } from './config/secrets'
import { setupOpenApi } from './config/openapi.config'
import { SafeExceptionFilter } from './common/safe-exception.filter'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  )
  app.useGlobalFilters(new SafeExceptionFilter())
  applyAppConfig(app)
  if (enableApiDocs()) setupOpenApi(app)
  const port = appConfig.port()
  await app.listen(port)
  const origin = `http://localhost:${port}`
  console.log(`API listening on ${origin}`)
  if (enableApiDocs()) {
    console.log(`Scalar  ${origin}${appConfig.path('docs')}`)
    console.log(`Swagger ${origin}${appConfig.path('swagger')}`)
  }
}

bootstrap()
