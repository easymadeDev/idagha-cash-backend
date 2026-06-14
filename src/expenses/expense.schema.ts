import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExpenseDocument = Expense & Document;

@Schema({ timestamps: true })
export class Expense {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  date: Date;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 'general' })
  category: string;

  @Prop({ default: '' })
  approvedBy: string;

  // 'group' = Group Wallet | 'reunion' = Reunion Fund Wallet (legacy field kept for backwards compat)
  @Prop({ default: 'group' })
  wallet: string;

  @Prop({ default: '' })
  walletId: string;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);
