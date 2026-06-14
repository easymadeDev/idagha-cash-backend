import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ContributionDocument = Contribution & Document;

@Schema({ timestamps: true })
export class Contribution {
  @Prop({ required: true })
  contributorName: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  date: Date;

  @Prop({ default: '' })
  note: string;

  @Prop({ default: 'general' })
  category: string;

  @Prop({ default: '' })
  walletId: string;
}

export const ContributionSchema = SchemaFactory.createForClass(Contribution);
