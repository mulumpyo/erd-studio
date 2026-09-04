import { join } from 'node:path'
import { Module } from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { AuthModule } from './auth.module'
import { PrismaModule } from './prisma.module'
import { ProjectsModule } from './projects.module'
import { TeamsModule } from './teams.module'
import { SqlModule } from './sql.module'
import { ChatModule } from './chat.module'
import { InvitationsModule } from './invitations.module'
import { RedisModule } from './redis.module'
import { UsageModule } from './usage.module'
import { AdminModule } from './admin.module'
import { HealthController } from '../controllers/health.controller'
import { RedisService } from '../services/redis.service'
import { redisThrottlerStorage } from '../common/redis-throttler.storage'
import { UsageInterceptor } from '../common/usage.interceptor'

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(process.cwd(), '../../.env'), '.env'],
    }),
    PrismaModule,
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 120 }],
        storage: redisThrottlerStorage(redis),
      }),
    }),
    InvitationsModule,
    AuthModule,
    ProjectsModule,
    TeamsModule,
    SqlModule,
    ChatModule,
    UsageModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: UsageInterceptor },
  ],
})
export class AppModule {}
