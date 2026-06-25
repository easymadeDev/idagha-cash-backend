import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { Member, MemberSchema } from '../members/member.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Member.name, schema: MemberSchema }]),
  ],
  providers: [WhatsappService],
  controllers: [WhatsappController],
  exports: [WhatsappService],
})
export class WhatsappModule {}
