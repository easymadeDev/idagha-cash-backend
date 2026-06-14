import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { ContributionsModule } from '../contributions/contributions.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { ReunionFundModule } from '../reunion-fund/reunion-fund.module';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [ContributionsModule, ExpensesModule, ReunionFundModule, WalletsModule],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
