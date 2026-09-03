import { Global, Module } from '@nestjs/common'
import { RedisService } from '../services/redis.service'
import { CollabAclService } from '../services/collab-acl.service'

@Global()
@Module({
  providers: [RedisService, CollabAclService],
  exports: [RedisService, CollabAclService],
})
export class RedisModule {}
