import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExecutiveDocument = Executive & Document;

@Schema({ timestamps: true })
export class Executive {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  position: string; // e.g. Chairman, General Secretary

  @Prop({ default: '' })
  memberId: string; // linked member _id (optional)

  @Prop({ default: '' })
  photo: string; // base64 data URL

  @Prop({ default: '' })
  bio: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ default: '' })
  tenure: string; // e.g. "2024 – 2026" — groups past executive teams

  @Prop({ default: true })
  isCurrent: boolean;

  @Prop({ default: 0 })
  order: number; // display order within a team (lower first)
}

export const ExecutiveSchema = SchemaFactory.createForClass(Executive);
