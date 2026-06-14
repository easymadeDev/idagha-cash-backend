import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReunionFundController } from './reunion-fund.controller';
import { ReunionFundService } from './reunion-fund.service';
import { ReunionFund, ReunionFundSchema } from './reunion-fund.schema';
import { Contribution, ContributionSchema } from '../contributions/contribution.schema';
import { Member, MemberSchema } from '../members/member.schema';
import { Wallet, WalletSchema } from '../wallets/wallet.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReunionFund.name, schema: ReunionFundSchema },
      { name: Contribution.name, schema: ContributionSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Wallet.name, schema: WalletSchema },
    ]),
  ],
  controllers: [ReunionFundController],
  providers: [ReunionFundService],
  exports: [ReunionFundService],
})
export class ReunionFundModule {}
