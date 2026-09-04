import { Module } from '@nestjs/common'
import { AdminController } from '../controllers/admin.controller'
import { AdminService } from '../services/admin.service'
import { AuthModule } from './auth.module'
import { UsageModule } from './usage.module'

@Module({
  imports: [AuthModule, UsageModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
