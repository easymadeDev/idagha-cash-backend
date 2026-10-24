import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PhotoDocument = Photo & Document;

@Schema({ timestamps: true })
export class Photo {
  @Prop({ required: true })
  image: string; // base64 data URL, resized client-side

  @Prop({ default: 'Memories' })
  album: string; // e.g. "2018 Graduation", "Reunion 2025"

  @Prop({ default: '' })
  caption: string;

  @Prop({ default: '' })
  uploadedBy: string; // member name or "Secretary"

  @Prop({ default: '' })
  memberId: string;

  // 'approved' | 'pending' — member submissions wait for admin approval
  @Prop({ default: 'approved', index: true })
  status: string;
}

export const PhotoSchema = SchemaFactory.createForClass(Photo);
