import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PledgeDocument = Pledge & Document;

@Schema({ timestamps: true })
export class Pledge {
  @Prop({ required: true }) memberName: string;
  @Prop({ default: '' }) memberEmail: string;
  @Prop({ default: '' }) memberPhone: string;
  @Prop({ type: Types.ObjectId, ref: 'Member', default: null }) memberId: Types.ObjectId | null;
  @Prop({ required: true }) amount: number;
  @Prop({ default: 'pending' }) status: string; // 'pending' | 'fulfilled' | 'cancelled'
  @Prop({ default: 'self' }) addedBy: string; // 'self' | 'admin'
  @Prop({ default: '' }) note: string;
  @Prop({ default: null }) dueDate: Date | null;
  @Prop({ default: null }) fulfilledAt: Date | null;
}

export const PledgeSchema = SchemaFactory.createForClass(Pledge);
