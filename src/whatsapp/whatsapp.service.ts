import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { Member, MemberDocument } from '../members/member.schema';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;
  private enabled = false;

  constructor(
    private config: ConfigService,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
  ) {}

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

  isReady(): boolean { return this.enabled; }
  getQr() { return null; }

  private normalizeDigits(phone: string): string {
    let d = phone.replace(/\D/g, '');
    if (d.startsWith('0') && d.length === 11) d = '234' + d.slice(1);
    return d;
  }

  private normalizePhone(phone: string): string {
    return `whatsapp:+${this.normalizeDigits(phone)}`;
  }

  async sendMessage(phone: string, message: string): Promise<void> {
    if (!this.enabled) throw new Error('Twilio WhatsApp not configured.');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const body = new URLSearchParams({
      From: this.fromNumber,
      To:   this.normalizePhone(phone),
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
      throw new Error((err as any)?.message || `Twilio error ${res.status}`);
    }
  }

  // Called by the webhook when someone sends "join write-personal"
  async markSubscribed(rawPhone: string): Promise<void> {
    const digits = this.normalizeDigits(rawPhone);
    const last10 = digits.slice(-10);
    this.logger.log(`Webhook: trying to match phone ${rawPhone} → digits=${digits} last10=${last10}`);

    const members = await this.memberModel.find({
      $or: [
        { whatsapp: { $regex: last10 } },
        { phone:    { $regex: last10 } },
      ],
    }).exec();

    if (members.length === 0) {
      this.logger.warn(`Webhook: no member found for phone ${rawPhone}`);
      return;
    }

    for (const m of members) {
      await this.memberModel.findByIdAndUpdate(m._id, { whatsappSubscribed: true }).exec();
      this.logger.log(`WhatsApp subscribed: ${m.name} (${rawPhone})`);
    }
  }

  // Admin: manually toggle WhatsApp subscription by member ID
  async markSubscribedById(memberId: string, subscribed = true): Promise<{ ok: boolean }> {
    await this.memberModel.findByIdAndUpdate(memberId, { whatsappSubscribed: subscribed }).exec();
    return { ok: true };
  }
}
