import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { ContributionsModule } from './contributions/contributions.module';
import { ExpensesModule } from './expenses/expenses.module';
import { ReunionFundModule } from './reunion-fund/reunion-fund.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { StatsModule } from './stats/stats.module';
import { MembersModule } from './members/members.module';
import { ActivityModule } from './activity/activity.module';
import { WalletsModule } from './wallets/wallets.module';
import { SettingsModule } from './settings/settings.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { CronModule } from './cron/cron.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/idagha',
      }),
    }),
    AuthModule,
    ContributionsModule,
    ExpensesModule,
    ReunionFundModule,
    AnnouncementsModule,
    StatsModule,
    MembersModule,
    ActivityModule,
    WalletsModule,
    SettingsModule,
    WhatsappModule,
    CronModule,
  ],
})
export class AppModule {}
