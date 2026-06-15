import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContributionsController } from './contributions.controller';
import { ContributionsService } from './contributions.service';
import { Contribution, ContributionSchema } from './contribution.schema';
import { Wallet, WalletSchema } from '../wallets/wallet.schema';
import { Member, MemberSchema } from '../members/member.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contribution.name, schema: ContributionSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: Member.name, schema: MemberSchema },
    ]),
  ],
  controllers: [ContributionsController],
  providers: [ContributionsService],
  exports: [ContributionsService],
})
export class ContributionsModule {}
