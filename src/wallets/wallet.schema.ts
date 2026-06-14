import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WalletDocument = Wallet & Document;

@Schema({ timestamps: true })
export class Wallet {
  @Prop({ required: true }) name: string;
  @Prop({ default: '' }) description: string;
  @Prop({ default: 'general' }) type: string; // 'general' | 'reunion' | 'custom'
  @Prop({ default: '#22c55e' }) color: string;
  @Prop({ default: true }) isActive: boolean;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);
