import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { Member, MemberSchema } from './member.schema';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AuthModule } from '../auth/auth.module';
import { BirthdayScheduler } from './birthday.scheduler';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Member.name, schema: MemberSchema }]),
    WhatsappModule,
    AuthModule,
  ],
  controllers: [MembersController],
  providers: [MembersService, BirthdayScheduler],
  exports: [MembersService],
})
export class MembersModule {}
