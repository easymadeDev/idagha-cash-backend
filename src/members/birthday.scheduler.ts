import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Member, MemberDocument } from './member.schema';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class BirthdayScheduler {
  private readonly logger = new Logger(BirthdayScheduler.name);

  constructor(
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    private config: ConfigService,
    private wa: WhatsappService,
  ) {
    this.logger.log('BirthdayScheduler initialized — will run at 6:40 PM daily');
  }

  private async sendEmail(to: string, subject: string, html: string) {
    const serviceId = this.config.get<string>('EMAILJS_SERVICE_ID');
    const templateId = this.config.get<string>('EMAILJS_TEMPLATE_ID');
    const userId = this.config.get<string>('EMAILJS_PUBLIC_KEY');
    const privateKey = this.config.get<string>('EMAILJS_PRIVATE_KEY');
    if (!serviceId || !templateId || !userId || !privateKey) return;

    try {
      await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: userId,
          accessToken: privateKey,
          template_params: { to_email: to, subject, html },
        }),
      });
    } catch (err) {
      this.logger.error(`Birthday email failed: ${err}`);
    }
  }

  @Cron('17 19 * * *')
  async sendBirthdayWishes() {
    try {
      const today = new Date();
      const monthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const members = await this.memberModel.find({
        status: 'active',
        birthday: { $regex: monthDay },
      }).exec();

      for (const member of members) {
        await this.sendBirthdayWish(member);
      }

      if (members.length > 0) {
        this.logger.log(`Birthday wishes sent to ${members.length} member(s)`);
      }
    } catch (err: any) {
      this.logger.error(`Birthday scheduler error: ${err?.message || 'Unknown error'}`);
    }
  }

  private async sendBirthdayWish(member: MemberDocument) {
    const name = member.name.split(' ')[0];
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; color: #fff;">
        <div style="text-align: center; padding: 20px 0;">
          <h1 style="margin: 0; font-size: 2.5rem;">🎂 Happy Birthday! 🎂</h1>
        </div>
        <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 1.1rem; margin: 0; text-align: center;">
            Dear <strong>${member.name}</strong>,
          </p>
          <p style="font-size: 1rem; margin: 15px 0; line-height: 1.6; text-align: center;">
            On behalf of the entire IDAGHA Secondary School Class of 2018 Alumni, we wish you a fantastic birthday filled with joy, laughter, and wonderful memories!
          </p>
          <p style="font-size: 0.95rem; margin: 15px 0; text-align: center;">
            Thank you for being part of our alumni family. We hope this year brings you health, happiness, and success!
          </p>
        </div>
        <div style="text-align: center; padding: 10px 0;">
          <p style="margin: 5px 0; font-size: 0.9rem;">
            🎉 Enjoy your special day! 🎉
          </p>
        </div>
        <div style="text-align: center; padding: 15px 0; border-top: 1px solid rgba(255,255,255,0.2); margin-top: 20px; font-size: 0.85rem;">
          IDAGHA Secondary School Class of 2018 Alumni
        </div>
      </div>
    `;

    if (member.email) {
      this.logger.log(`Sending birthday email to ${member.email}`);
      await this.sendEmail(member.email, `🎂 Happy Birthday, ${name}! 🎂`, html);
      this.logger.log(`Birthday email sent to ${member.email}`);
    } else {
      this.logger.log(`No email for member ${member.name}`);
    }

    const waPhone = (member as any).whatsapp || (member as any).phone;
    if (waPhone && this.wa.isReady()) {
      const msg = `🎂 *Happy Birthday, ${name}!* 🎂\n\nOn behalf of the entire *IDAGHA Secondary School Class of 2018 Alumni*, we wish you a fantastic birthday filled with joy, laughter, and wonderful memories!\n\nThank you for being part of our alumni family. Enjoy your special day! 🎉`;
      await this.wa.sendMessage(waPhone, msg).catch((err) => {
        this.logger.warn(`Birthday WhatsApp failed: ${err.message}`);
      });
    }
  }
}
