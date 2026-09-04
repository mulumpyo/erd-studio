import { Module } from '@nestjs/common'
import { RedisModule } from './redis.module'
import { UsageService } from '../services/usage.service'

@Module({
  imports: [RedisModule],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
