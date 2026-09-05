import { Global, Module } from '@nestjs/common'
import { NotifyController } from '../controllers/notify.controller'
import { NotifyService } from '../services/notify.service'

@Global()
@Module({
  controllers: [NotifyController],
  providers: [NotifyService],
  exports: [NotifyService],
})
export class NotifyModule {}
