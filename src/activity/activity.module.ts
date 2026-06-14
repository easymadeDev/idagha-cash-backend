import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { Contribution, ContributionSchema } from '../contributions/contribution.schema';
import { Expense, ExpenseSchema } from '../expenses/expense.schema';
import { Member, MemberSchema } from '../members/member.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Contribution.name, schema: ContributionSchema },
      { name: Expense.name,      schema: ExpenseSchema },
      { name: Member.name,       schema: MemberSchema },
    ]),
  ],
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
