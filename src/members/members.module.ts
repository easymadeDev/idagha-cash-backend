import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';
import { Member, MemberSchema } from './member.schema';
import { Contribution, ContributionSchema } from '../contributions/contribution.schema';
import { Pledge, PledgeSchema } from '../pledges/pledge.schema';
import { AwardNominee, AwardNomineeSchema } from '../awards/award.schema';
import { Rsvp, RsvpSchema } from '../events/event.schema';
import { Nomination, NominationSchema } from '../elections/nomination.schema';
import { Executive, ExecutiveSchema } from '../executives/executive.schema';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AuthModule } from '../auth/auth.module';
import { BirthdayScheduler } from './birthday.scheduler';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberSchema },
      { name: Contribution.name, schema: ContributionSchema },
      { name: Pledge.name, schema: PledgeSchema },
      // other records that keep a copy of the member's photo
      { name: AwardNominee.name, schema: AwardNomineeSchema },
      { name: Rsvp.name, schema: RsvpSchema },
      { name: Nomination.name, schema: NominationSchema },
      { name: Executive.name, schema: ExecutiveSchema },
    ]),
    WhatsappModule,
    AuthModule,
  ],
  controllers: [MembersController],
  providers: [MembersService, BirthdayScheduler],
  exports: [MembersService],
})
export class MembersModule {}
