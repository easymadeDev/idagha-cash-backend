import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AwardsController } from './awards.controller';
import { AwardsService } from './awards.service';
import {
  AwardCategory, AwardCategorySchema, AwardNominee, AwardNomineeSchema, AwardSupport, AwardSupportSchema,
} from './award.schema';
import { Member, MemberSchema } from '../members/member.schema';
import { AuthModule } from '../auth/auth.module';
import { MemberAuthGuard } from '../auth/member-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AwardCategory.name, schema: AwardCategorySchema },
      { name: AwardNominee.name, schema: AwardNomineeSchema },
      { name: AwardSupport.name, schema: AwardSupportSchema },
      { name: Member.name, schema: MemberSchema },
    ]),
    AuthModule,
  ],
  controllers: [AwardsController],
  providers: [AwardsService, MemberAuthGuard],
})
export class AwardsModule {}
