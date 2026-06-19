import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CronScheduleDocument = CronSchedule & Document;

@Schema({ timestamps: true })
export class CronSchedule {
  @Prop({ default: '0 8 * * *' })
  birthdayTime: string; // Cron format: "0 8 * * *" = 8:00 AM daily

  @Prop({ default: '0 8 * * 1' })
  reunionReminderTime: string; // Cron format: "0 8 * * 1" = Monday 8:00 AM

  @Prop({ default: true })
  birthdayEnabled: boolean;

  @Prop({ default: true })
  reunionReminderEnabled: boolean;
}

export const CronScheduleSchema = SchemaFactory.createForClass(CronSchedule);
