import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

// Fun class awards — "Best Online", "Most Active", etc.
export type AwardCategoryDocument = AwardCategory & Document;

@Schema({ timestamps: true })
export class AwardCategory {
  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '🏆' })
  emoji: string;

  @Prop({ default: '' })
  season: string; // e.g. "2026 Class Awards"

  // 'draft' | 'open' (nominate + support) | 'closed' (winner revealed)
  @Prop({ default: 'open' })
  status: string;

  @Prop({ default: 0 })
  order: number;
}
export const AwardCategorySchema = SchemaFactory.createForClass(AwardCategory);

export type AwardNomineeDocument = AwardNominee & Document;

@Schema({ timestamps: true })
export class AwardNominee {
  @Prop({ required: true, index: true })
  categoryId: string;

  @Prop({ required: true })
  memberId: string; // the nominee

  @Prop({ required: true })
  memberName: string;

  @Prop({ default: '' })
  memberPhoto: string;

  @Prop({ default: '' })
  nominatedById: string;

  @Prop({ default: '' })
  nominatedByName: string;

  @Prop({ default: '' })
  reason: string;

  @Prop({ default: false })
  hidden: boolean; // admin moderation
}
export const AwardNomineeSchema = SchemaFactory.createForClass(AwardNominee);
AwardNomineeSchema.index({ categoryId: 1, memberId: 1 }, { unique: true });

export type AwardSupportDocument = AwardSupport & Document;

// One support per member per category (can be switched while open)
@Schema({ timestamps: true })
export class AwardSupport {
  @Prop({ required: true })
  categoryId: string;

  @Prop({ required: true })
  nomineeId: string;

  @Prop({ required: true })
  memberId: string; // supporter
}
export const AwardSupportSchema = SchemaFactory.createForClass(AwardSupport);
AwardSupportSchema.index({ categoryId: 1, memberId: 1 }, { unique: true });
