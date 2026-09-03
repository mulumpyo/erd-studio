import { Module } from '@nestjs/common'
import { SqlController } from '../controllers/sql.controller'

@Module({
  controllers: [SqlController],
})
export class SqlModule {}
