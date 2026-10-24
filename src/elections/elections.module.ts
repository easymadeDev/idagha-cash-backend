import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ElectionsController } from './elections.controller';
import { ElectionsService } from './elections.service';
import { Election, ElectionSchema } from './election.schema';
import { Nomination, NominationSchema } from './nomination.schema';
import { Vote, VoteSchema } from './vote.schema';
import { Member, MemberSchema } from '../members/member.schema';
import { Contribution, ContributionSchema } from '../contributions/contribution.schema';
import { WalletsModule } from '../wallets/wallets.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AuthModule } from '../auth/auth.module';
import { MemberAuthGuard } from '../auth/member-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Election.name, schema: ElectionSchema },
      { name: Nomination.name, schema: NominationSchema },
      { name: Vote.name, schema: VoteSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Contribution.name, schema: ContributionSchema },
    ]),
    WalletsModule,
    WhatsappModule,
    AuthModule,
  ],
  controllers: [ElectionsController],
  providers: [ElectionsService, MemberAuthGuard],
})
export class ElectionsModule {}
