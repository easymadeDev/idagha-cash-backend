import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappAuth, WhatsappAuthSchema } from './whatsapp-auth.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: WhatsappAuth.name, schema: WhatsappAuthSchema }]),
  ],
  providers: [WhatsappService],
  controllers: [WhatsappController],
  exports: [WhatsappService],
})
export class WhatsappModule {}
