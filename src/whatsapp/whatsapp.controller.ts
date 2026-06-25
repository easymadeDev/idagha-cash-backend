import { Controller, Delete, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { WhatsappService } from './whatsapp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private wa: WhatsappService) {}

  @Get('status')
  status() {
    return { ready: this.wa.isReady(), hasQr: !!this.wa.getQr() };
  }

  @Get('qr')
  qr(@Res() res: Response) {
    const qr = this.wa.getQr();
    if (!qr) return res.status(200).json({ qr: null, ready: this.wa.isReady() });
    return res.status(200).json({ qr, ready: false });
  }

  // Clear stored credentials and force a fresh QR scan
  @UseGuards(JwtAuthGuard)
  @Delete('logout')
  async logout() {
    await this.wa.logout();
    return { ok: true, message: 'WhatsApp session cleared. Restart the server to get a new QR.' };
  }
}
