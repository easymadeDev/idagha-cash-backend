import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private wa: WhatsappService) {}

  @Get('status')
  status() {
    return { ready: this.wa.isReady(), hasQr: !!this.wa.getQr() };
  }

  // Returns the raw QR string — frontend can render it
  @Get('qr')
  qr(@Res() res: Response) {
    const qr = this.wa.getQr();
    if (!qr) {
      return res.status(200).json({ qr: null, ready: this.wa.isReady() });
    }
    return res.status(200).json({ qr, ready: false });
  }
}
