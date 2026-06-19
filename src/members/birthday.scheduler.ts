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
    if (!serviceId || !templateId || !userId || !privateKey) {
      this.logger.error('EmailJS config missing');
      return;
    }

    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
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

      if (!res.ok) {
        const error = await res.text();
        this.logger.error(`EmailJS error (${res.status}): ${error}`);
        return;
      }

      this.logger.log(`✓ Email response OK from EmailJS`);
    } catch (err: any) {
      this.logger.error(`Email fetch failed: ${err.message}`);
    }
  }

  @Cron('50 19 * * *')
  async sendBirthdayWishes() {
    await this.checkAndSendBirthdays();
  }

  async checkAndSendBirthdays() {
    const result = {
      success: false,
      timestamp: new Date().toISOString(),
      message: '',
      membersChecked: 0,
      matchesFound: 0,
      processed: [] as any[],
      errors: [] as string[],
    };

    try {
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const monthDay = `${month}-${day}`;

      this.logger.log(`🎂 Birthday check triggered: ${today.toISOString()}`);
      this.logger.log(`Looking for birthdays on: ${monthDay}`);

      const allMembers = await this.memberModel.find({ status: 'active' }).exec();
      result.membersChecked = allMembers.length;
      this.logger.log(`Total active members: ${allMembers.length}`);

      const matches: any[] = [];
      for (const member of allMembers) {
        if (!member.birthday) continue;

        const bday = member.birthday.trim();
        this.logger.debug(`Member: ${member.name}, Birthday field: "${bday}"`);

        // Try multiple birthday formats
        if (
          bday.includes(monthDay) ||
          bday.endsWith(`-${month}-${day}`) ||
          bday.includes(`${day}/${month}`) ||
          bday.includes(`${month}/${day}`)
        ) {
          this.logger.log(`✓ Match found: ${member.name}`);
          matches.push(member);
        }
      }

      result.matchesFound = matches.length;
      this.logger.log(`Found ${matches.length} birthday match(es) today`);

      for (const member of matches) {
        await this.sendBirthdayWish(member);
        result.processed.push({
          name: member.name,
          email: member.email || 'N/A',
          status: 'sent',
        });
      }

      result.success = true;
      result.message = `Birthday wishes processed for ${matches.length} member(s)`;

      if (matches.length > 0) {
        this.logger.log(`✅ ${result.message}`);
      } else {
        this.logger.log(`ℹ️ No birthdays today`);
      }
    } catch (err: any) {
      result.success = false;
      result.message = `Error: ${err?.message || 'Unknown error'}`;
      result.errors.push(err?.message || 'Unknown error');
      this.logger.error(`Birthday scheduler error: ${err?.message || 'Unknown error'}`);
    }

    return result;
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

    // WhatsApp disabled — Baileys unreliable on Render, email only
  }
}
