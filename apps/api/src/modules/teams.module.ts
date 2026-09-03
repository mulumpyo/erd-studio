import { Module } from '@nestjs/common'
import { TeamsService } from '../services/teams.service'
import { TeamsController } from '../controllers/teams.controller'
import { ProjectsModule } from './projects.module'

@Module({
  imports: [ProjectsModule],
  providers: [TeamsService],
  controllers: [TeamsController],
})
export class TeamsModule {}
