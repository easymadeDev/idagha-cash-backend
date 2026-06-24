import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PledgesController } from './pledges.controller';
import { PledgesService } from './pledges.service';
import { Pledge, PledgeSchema } from './pledge.schema';
import { Member, MemberSchema } from '../members/member.schema';
import { Contribution, ContributionSchema } from '../contributions/contribution.schema';
import { Wallet, WalletSchema } from '../wallets/wallet.schema';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Pledge.name, schema: PledgeSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Contribution.name, schema: ContributionSchema },
      { name: Wallet.name, schema: WalletSchema },
    ]),
    WhatsappModule,
  ],
  controllers: [PledgesController],
  providers: [PledgesService],
  exports: [PledgesService],
})
export class PledgesModule {}
