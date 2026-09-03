import { Module } from '@nestjs/common'
import { ProjectsService } from '../services/projects.service'
import { ProjectsController } from '../controllers/projects.controller'

@Module({
  providers: [ProjectsService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
