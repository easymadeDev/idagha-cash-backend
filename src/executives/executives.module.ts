import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExecutivesController } from './executives.controller';
import { ExecutivesService } from './executives.service';
import { Executive, ExecutiveSchema } from './executive.schema';
import { Member, MemberSchema } from '../members/member.schema';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Executive.name, schema: ExecutiveSchema },
    { name: Member.name, schema: MemberSchema },
  ])],
  controllers: [ExecutivesController],
  providers: [ExecutivesService],
})
export class ExecutivesModule {}
