import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private accountSid: string;
  private authToken: string;
  private fromNumber: string; // e.g. whatsapp:+14155238886
  private enabled = false;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    this.accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID') || '';
    this.authToken  = this.config.get<string>('TWILIO_AUTH_TOKEN')  || '';
    const from      = this.config.get<string>('TWILIO_WHATSAPP_FROM') || '';
    this.fromNumber = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
    this.enabled    = !!(this.accountSid && this.authToken && from);
    if (this.enabled) {
      this.logger.log('✅ Twilio WhatsApp ready');
    } else {
      this.logger.warn('Twilio WhatsApp not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM');
    }
  }

  isReady(): boolean {
    return this.enabled;
  }

  // kept for controller compatibility
  getQr() { return null; }

  private normalizePhone(phone: string): string {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length === 11) digits = '234' + digits.slice(1);
    return `whatsapp:+${digits}`;
  }

  async sendMessage(phone: string, message: string): Promise<void> {
    if (!this.enabled) throw new Error('Twilio WhatsApp not configured.');
    const to = this.normalizePhone(phone);
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const body = new URLSearchParams({
      From: this.fromNumber,
      To:   to,
      Body: message,
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64'),
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as any;
      throw new Error(err?.message || `Twilio error ${res.status}`);
    }
  }
}
