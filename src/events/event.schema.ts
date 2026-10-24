import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AlumniEventDocument = AlumniEvent & Document;

@Schema({ timestamps: true, collection: 'events' })
export class AlumniEvent {
  @Prop({ required: true })
  title: string;

  // 'reunion' | 'meeting' | 'social' | 'outreach' | 'other'
  @Prop({ default: 'reunion' })
  type: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true })
  date: Date;

  @Prop()
  endDate: Date;

  @Prop({ default: '' })
  venue: string;

  @Prop({ default: '' })
  coverImage: string; // base64 data URL

  @Prop({ default: 0 })
  fee: number; // 0 = free

  @Prop({ default: '' })
  dressCode: string;

  @Prop({ default: 0 })
  capacity: number; // 0 = unlimited

  @Prop({ default: true })
  rsvpOpen: boolean;

  @Prop({ default: true })
  isPublished: boolean;
}

export const AlumniEventSchema = SchemaFactory.createForClass(AlumniEvent);

export type RsvpDocument = Rsvp & Document;

@Schema({ timestamps: true })
export class Rsvp {
  @Prop({ required: true })
  eventId: string;

  @Prop({ required: true })
  memberId: string;

  @Prop({ required: true })
  memberName: string;

  @Prop({ default: '' })
  memberPhoto: string;

  // 'going' | 'maybe' | 'not_going'
  @Prop({ default: 'going' })
  status: string;

  @Prop({ default: 0 })
  guests: number;

  @Prop({ default: '' })
  note: string;
}

export const RsvpSchema = SchemaFactory.createForClass(Rsvp);
RsvpSchema.index({ eventId: 1, memberId: 1 }, { unique: true });
