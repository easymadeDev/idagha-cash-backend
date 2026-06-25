import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CronScheduleDocument = CronSchedule & Document;

@Schema({ timestamps: true })
export class CronSchedule {
  @Prop({ default: '0 8 * * *' })
  birthdayTime: string;

  @Prop({ default: '0 8 * * 1' })
  reunionReminderTime: string;

  @Prop({ default: true })
  birthdayEnabled: boolean;

  @Prop({ default: true })
  reunionReminderEnabled: boolean;

  @Prop({ type: [String], default: ['email', 'whatsapp'] })
  birthdayChannels: string[];

  @Prop({ type: [String], default: ['email', 'whatsapp'] })
  reunionReminderChannels: string[];
}

export const CronScheduleSchema = SchemaFactory.createForClass(CronSchedule);
