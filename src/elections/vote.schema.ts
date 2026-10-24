import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VoteDocument = Vote & Document;

@Schema({ timestamps: true })
export class Vote {
  @Prop({ required: true })
  electionId: string;

  @Prop({ required: true })
  positionId: string;

  @Prop({ required: true })
  candidateId: string; // Nomination _id

  @Prop({ required: true })
  memberId: string;
}

export const VoteSchema = SchemaFactory.createForClass(Vote);
// One vote per member per position — enforced by the database, not just the service
VoteSchema.index({ electionId: 1, positionId: 1, memberId: 1 }, { unique: true });
