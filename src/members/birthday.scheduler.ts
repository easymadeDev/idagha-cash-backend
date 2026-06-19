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

  @Cron('30 20 * * *')
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
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; padding: 0; font-family: 'Segoe UI', Trebuchet MS, sans-serif; background-color: #f5f5f5; }
            .container { max-width: 650px; margin: 0 auto; padding: 20px; }
            .email-wrapper { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(102, 126, 234, 0.2); }
            .header { background: rgba(0,0,0,0.1); padding: 40px 30px; text-align: center; }
            .confetti { font-size: 2rem; display: inline-block; margin: 0 4px; animation: bounce 1s ease-in-out infinite; }
            @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
            .header h1 { margin: 0; font-size: 3rem; color: #fff; font-weight: 800; letter-spacing: -1px; }
            .header p { margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 1.1rem; }
            .content { padding: 40px 30px; background: rgba(255,255,255,0.08); color: #fff; }
            .greeting { font-size: 1.3rem; margin: 0 0 20px 0; font-weight: 600; }
            .message { font-size: 0.95rem; line-height: 1.8; margin: 0 0 20px 0; color: rgba(255,255,255,0.95); }
            .highlight { background: rgba(255,255,255,0.15); padding: 20px; border-radius: 12px; border-left: 4px solid #ffd700; margin: 20px 0; font-style: italic; }
            .cta-button { display: inline-block; background: #ffd700; color: #667eea; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 0.95rem; margin: 20px 0; transition: all 0.3s ease; }
            .cta-button:hover { background: #ffed4e; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(255, 215, 0, 0.3); }
            .footer { background: rgba(0,0,0,0.15); padding: 25px 30px; text-align: center; font-size: 0.85rem; color: rgba(255,255,255,0.7); border-top: 1px solid rgba(255,255,255,0.1); }
            .footer-text { margin: 0; }
            .footer-text strong { color: rgba(255,255,255,0.9); }
            .wishes { display: flex; justify-content: space-around; padding: 20px 0; margin: 20px 0; border-top: 1px solid rgba(255,255,255,0.2); border-bottom: 1px solid rgba(255,255,255,0.2); }
            .wish-item { text-align: center; font-size: 2rem; animation: float 3s ease-in-out infinite; }
            @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="email-wrapper">
              <div class="header">
                <div>
                  <span class="confetti">🎂</span>
                  <h1>Happy Birthday!</h1>
                  <span class="confetti">🎉</span>
                </div>
                <p>Celebrating your special day with you</p>
              </div>

              <div class="content">
                <p class="greeting">Dear <strong>${name}</strong>,</p>

                <p class="message">
                  On behalf of the entire <strong>IDAGHA Secondary School Class of 2018 Alumni</strong> community, we are delighted to celebrate your birthday with you! 🎊
                </p>

                <div class="wishes">
                  <div class="wish-item">🎁</div>
                  <div class="wish-item">💫</div>
                  <div class="wish-item">🎈</div>
                </div>

                <div class="highlight">
                  "May your birthday be filled with joy, laughter, and wonderful memories. Here's to another year of health, happiness, and endless possibilities!"
                </div>

                <p class="message">
                  Thank you for being an integral part of our alumni family. Your presence and contributions mean so much to all of us. We're grateful for the bond we share as members of the Class of 2018.
                </p>

                <center>
                  <a href="https://idagha2018alumni-beta.vercel.app" class="cta-button">Visit Alumni Portal</a>
                </center>

                <p class="message" style="text-align: center; margin-top: 30px; color: rgba(255,255,255,0.8);">
                  <strong>Wishing you the very best on your special day! 🌟</strong>
                </p>
              </div>

              <div class="footer">
                <p class="footer-text">
                  <strong>IDAGHA Secondary School</strong><br>
                  Class of 2018 Alumni Association
                </p>
                <p style="margin: 10px 0 0 0; font-size: 0.75rem; color: rgba(255,255,255,0.5);">
                  This is an automated birthday greeting. Celebrating our alumni family! 💚
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
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
