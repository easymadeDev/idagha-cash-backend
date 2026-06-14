import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContributionsController } from './contributions.controller';
import { ContributionsService } from './contributions.service';
import { Contribution, ContributionSchema } from './contribution.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Contribution.name, schema: ContributionSchema }]),
  ],
  controllers: [ContributionsController],
  providers: [ContributionsService],
  exports: [ContributionsService],
})
export class ContributionsModule {}
