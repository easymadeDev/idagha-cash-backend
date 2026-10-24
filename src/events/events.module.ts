import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { AlumniEvent, AlumniEventSchema, Rsvp, RsvpSchema } from './event.schema';
import { Member, MemberSchema } from '../members/member.schema';
import { AuthModule } from '../auth/auth.module';
import { MemberAuthGuard } from '../auth/member-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AlumniEvent.name, schema: AlumniEventSchema },
      { name: Rsvp.name, schema: RsvpSchema },
      { name: Member.name, schema: MemberSchema },
    ]),
    AuthModule,
  ],
  controllers: [EventsController],
  providers: [EventsService, MemberAuthGuard],
})
export class EventsModule {}
