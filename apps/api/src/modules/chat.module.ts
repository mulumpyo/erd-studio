import { Module } from '@nestjs/common'
import { ChatController } from '../controllers/chat.controller'
import { ChatService } from '../services/chat.service'
import { ProjectsModule } from './projects.module'

@Module({
  imports: [ProjectsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
