import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReunionFundDocument = ReunionFund & Document;

@Schema({ timestamps: true })
export class ReunionFund {
  @Prop({ required: true, default: 'Idagha 2026 Reunion Fund' })
  title: string;

  @Prop({ required: true, default: 3000000 })
  targetAmount: number;

  @Prop({ default: 0 })
  raisedAmount: number;

  @Prop({ default: new Date('2026-12-31') })
  targetDate: Date;

  @Prop({ default: '' })
  description: string;

  // Per-member target (e.g. ₦10,000 each — part-payment allowed)
  @Prop({ default: 10000 })
  memberTarget: number;

  // Total number of members expected to contribute
  @Prop({ default: 0 })
  totalMembers: number;

  @Prop({ default: true })
  isActive: boolean;
}

export const ReunionFundSchema = SchemaFactory.createForClass(ReunionFund);
