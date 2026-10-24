import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NominationDocument = Nomination & Document;

// One purchased nomination form — becomes a candidate once paid, submitted and cleared
@Schema({ timestamps: true })
export class Nomination {
  @Prop({ required: true, index: true })
  electionId: string;

  @Prop({ required: true })
  positionId: string;

  @Prop({ required: true })
  positionTitle: string;

  @Prop({ required: true, index: true })
  memberId: string;

  @Prop({ required: true })
  memberName: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ default: 0 })
  amount: number;

  @Prop({ required: true, unique: true })
  reference: string; // e.g. IDG-7K2Q9M — buyer uses it as transfer narration

  @Prop({ default: '' })
  payerName: string; // name on the sending bank account

  @Prop({ default: '' })
  proofImage: string; // base64 data URL of transfer receipt

  @Prop({ default: '' })
  note: string;

  // 'pending' | 'approved' | 'rejected'
  @Prop({ default: 'pending' })
  paymentStatus: string;

  @Prop({ default: '' })
  rejectReason: string;

  @Prop({ default: '' })
  contributionId: string; // contribution created on approval, so it can be reversed

  // Candidate application (filled after payment is approved)
  @Prop({ default: '' })
  manifesto: string;

  @Prop({ default: '' })
  slogan: string;

  @Prop({ default: '' })
  photo: string;

  // 'none' | 'submitted' | 'cleared' | 'disqualified'
  @Prop({ default: 'none' })
  applicationStatus: string;

  @Prop({ default: '' })
  screeningNote: string;
}

export const NominationSchema = SchemaFactory.createForClass(Nomination);
