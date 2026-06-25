import { Controller, Get, Post, Body, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
    const from: string = body?.From || '';
    const text: string = (body?.Body || '').trim().toLowerCase();

    if (text.startsWith('join ') && from.startsWith('whatsapp:')) {
      const phone = from.replace('whatsapp:', '').replace('+', '');
      await this.wa.markSubscribed(phone);
    }

    res.setHeader('Content-Type', 'text/xml');
    res.status(200).send('<Response></Response>');
  }

  // Admin: manually mark a member as WhatsApp subscribed by member ID
  @UseGuards(JwtAuthGuard)
  @Post('subscribe/:memberId')
  markSubscribedById(@Param('memberId') memberId: string) {
    return this.wa.markSubscribedById(memberId);
  }

  // Admin: manually unmark
  @UseGuards(JwtAuthGuard)
  @Post('unsubscribe/:memberId')
  markUnsubscribedById(@Param('memberId') memberId: string) {
    return this.wa.markSubscribedById(memberId, false);
  }
}
