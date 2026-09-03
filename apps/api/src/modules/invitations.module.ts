import { Global, Module } from '@nestjs/common'
import { InvitationsController } from '../controllers/invitations.controller'
import { InvitationsService } from '../services/invitations.service'
import { MailService } from '../services/mail.service'

@Global()
@Module({
  providers: [MailService, InvitationsService],
  controllers: [InvitationsController],
  exports: [InvitationsService, MailService],
})
export class InvitationsModule {}
