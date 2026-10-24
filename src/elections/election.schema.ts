import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ElectionDocument = Election & Document;

@Schema({ _id: true })
export class ElectionPosition {
  _id: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  requirements: string;

  @Prop({ default: 0 })
  formPrice: number;
}
export const ElectionPositionSchema = SchemaFactory.createForClass(ElectionPosition);

// Lifecycle: draft → forms (form sales open) → screening → voting → closed
export const ELECTION_STATUSES = ['draft', 'forms', 'screening', 'voting', 'closed'];

@Schema({ timestamps: true })
export class Election {
  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 'draft' })
  status: string;

  @Prop({ type: [ElectionPositionSchema], default: [] })
  positions: ElectionPosition[];

  // Bank transfer details shown to form buyers
  @Prop({ default: '' })
  bankName: string;

  @Prop({ default: '' })
  accountName: string;

  @Prop({ default: '' })
  accountNumber: string;

  @Prop()
  formSaleEnds: Date;

  @Prop()
  votingStarts: Date;

  @Prop()
  votingEnds: Date;
}

export const ElectionSchema = SchemaFactory.createForClass(Election);
