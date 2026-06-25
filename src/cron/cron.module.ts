import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { CronService } from './cron.service';
import { Member, MemberSchema } from '../members/member.schema';
import { ReunionFundModule } from '../reunion-fund/reunion-fund.module';
import { SettingsModule } from '../settings/settings.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Member.name, schema: MemberSchema }]),
    ReunionFundModule,
    SettingsModule,
    WhatsappModule,
  ],
  providers: [CronService],
})
export class CronModule {}
