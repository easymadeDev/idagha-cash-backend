import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MemberDocument = Member & Document;

@Schema({ timestamps: true })
export class Member {
  @Prop({ required: true })
  name: string;

  @Prop({ default: '' })
  nickname: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  whatsapp: string;

  @Prop({ default: '' })
  gender: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ default: '' })
  location: string;

  @Prop({ default: '' })
  occupation: string;

  @Prop({ default: '' })
  position: string;

  @Prop({ default: '' })
  birthday: string;

  // 'active' | 'pending' | 'inactive'
  @Prop({ default: 'active' })
  status: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: '' })
  photo: string; // base64 data URL

  @Prop({ default: false })
  whatsappSubscribed: boolean;
}

export const MemberSchema = SchemaFactory.createForClass(Member);
