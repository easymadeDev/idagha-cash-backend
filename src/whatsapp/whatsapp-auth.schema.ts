import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WhatsappAuthDocument = WhatsappAuth & Document;

@Schema({ collection: 'whatsappauthkeys' })
export class WhatsappAuth {
  @Prop({ required: true, unique: true })
  key: string;

  @Prop({ required: true })
  value: string;
}

export const WhatsappAuthSchema = SchemaFactory.createForClass(WhatsappAuth);
