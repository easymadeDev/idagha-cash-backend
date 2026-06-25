import { Controller, Get, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private wa: WhatsappService) {}

  @Get('status')
  status() {
    return { ready: this.wa.isReady(), provider: 'twilio' };
  }

  // Twilio sends a POST here when a message arrives at the sandbox number
  @Post('webhook')
  async webhook(@Body() body: any, @Res() res: Response) {
    const from: string = body?.From || '';   // e.g. "whatsapp:+2348012345678"
    const text: string = (body?.Body || '').trim().toLowerCase();

    if (text.startsWith('join ') && from.startsWith('whatsapp:')) {
      const phone = from.replace('whatsapp:', '').replace('+', '');
      await this.wa.markSubscribed(phone);
    }

    // Twilio expects a 200 TwiML response (empty is fine)
    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send('<Response></Response>');
  }
}
