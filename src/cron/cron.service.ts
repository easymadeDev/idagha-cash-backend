import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Member, MemberDocument } from '../members/member.schema';
import { ReunionFundService } from '../reunion-fund/reunion-fund.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  private birthdayCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    private config: ConfigService,
    private reunionFundService: ReunionFundService,
    private settingsService: SettingsService,
  ) {}

  private reunionReminderInterval: NodeJS.Timeout | null = null;

  onModuleInit() {
    this.startBirthdayScheduler();
    this.startReunionReminderScheduler();
    this.startKeepAlive();
  }

  private keepAliveInterval: NodeJS.Timeout | null = null;

  onModuleDestroy() {
    if (this.birthdayCheckInterval) clearInterval(this.birthdayCheckInterval);
    if (this.reunionReminderInterval) clearInterval(this.reunionReminderInterval);
    if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
  }

  private startKeepAlive() {
    const backendUrl = this.config.get<string>('BACKEND_URL') || 'https://idagha-2018.onrender.com/api';
    // Ping every 10 minutes to prevent Render free tier from sleeping
    this.keepAliveInterval = setInterval(async () => {
      try {
        await fetch(`${backendUrl}/auth/ping`).catch(() => {});
      } catch {}
    }, 10 * 60 * 1000);
    this.logger.log('Keep-alive ping started — every 10 minutes');
  }

  private startBirthdayScheduler() {
    this.logger.log('Birthday scheduler started — will use time from database');
    let lastTriggeredMinute = -1;

    const checkBirthday = async () => {
      try {
        const schedule = await this.settingsService.getCronSchedule();
        if (!schedule.birthdayEnabled) return;

        // Use local timezone (set via TZ env var)
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        const cronParts = schedule.birthdayTime.split(' ');
        const cronMinute = parseInt(cronParts[0]);
        const cronHour = parseInt(cronParts[1]);

        // Only trigger once per minute to avoid duplicates
        if (currentHour === cronHour && currentMinute === cronMinute && lastTriggeredMinute !== currentMinute) {
          lastTriggeredMinute = currentMinute;
          this.logger.log(`🎂 Birthday check triggered at ${cronHour}:${String(cronMinute).padStart(2, '0')}`);
          await this.checkAndSendBirthdays();
        }
        // Reset tracker when we leave the target minute
        if (currentMinute !== cronMinute) {
          lastTriggeredMinute = -1;
        }
      } catch (err: any) {
        this.logger.error(`Birthday scheduler error: ${err.message}`);
      }
    };

    this.birthdayCheckInterval = setInterval(checkBirthday, 10000);
    this.logger.log('Birthday scheduler interval set — checks every 10 seconds');
  }

  private startReunionReminderScheduler() {
    this.logger.log('Reunion fund reminder scheduler started — will use time from database');
    let lastTriggeredMinute = -1;

    const checkReunionReminder = async () => {
      try {
        const schedule = await this.settingsService.getCronSchedule();
        if (!schedule.reunionReminderEnabled) return;

        // Use local time (Nigeria: UTC+1)
        const now = new Date();
        const localTime = new Date(now.getTime() + (60 * 60 * 1000));
        const currentDay = localTime.getDay();
        const currentHour = localTime.getHours();
        const currentMinute = localTime.getMinutes();

        const cronParts = schedule.reunionReminderTime.split(' ');
        const cronMinute = parseInt(cronParts[0]);
        const cronHour = parseInt(cronParts[1]);
        const cronDay = parseInt(cronParts[4]); // 0 = Sunday, 1 = Monday, etc.

        // Only trigger once per minute to avoid duplicates
        if (currentDay === cronDay && currentHour === cronHour && currentMinute === cronMinute && lastTriggeredMinute !== currentMinute) {
          lastTriggeredMinute = currentMinute;
          this.logger.log(`💰 Reunion reminder check triggered at ${cronHour}:${String(cronMinute).padStart(2, '0')} on day ${currentDay}`);
          await this.sendReunionReminders();
        }
        // Reset tracker when we leave the target minute
        if (currentMinute !== cronMinute) {
          lastTriggeredMinute = -1;
        }
      } catch (err: any) {
        this.logger.error(`Reunion reminder scheduler error: ${err.message}`);
      }
    };

    this.reunionReminderInterval = setInterval(checkReunionReminder, 10000);
    this.logger.log('Reunion reminder interval set — checks every 10 seconds');
  }

  private async sendReunionReminders() {
    try {
      this.logger.log('Sending reunion fund reminders to incomplete members...');
      const result = await this.reunionFundService.sendReminders();
      this.logger.log(`✅ Reunion reminders sent: ${result.sent}, failed: ${result.failed.length}, no email: ${result.noEmail.length}`);
    } catch (err: any) {
      this.logger.error(`Reunion reminder error: ${err.message}`);
    }
  }

  private async checkAndSendBirthdays() {
    // Get local time (Nigeria: UTC+1)
    const utcNow = new Date();
    const localTime = new Date(utcNow.getTime() + (60 * 60 * 1000)); // Add 1 hour for Nigeria time
    const localTimestamp = localTime.toISOString().split('T')[0] + 'T' + localTime.toISOString().split('T')[1].replace('Z', '+01:00');

    const result = {
      success: false,
      timestamp: localTimestamp,
      message: '',
      membersChecked: 0,
      matchesFound: 0,
      processed: [] as any[],
      errors: [] as string[],
    };

    try {
      const month = String(localTime.getMonth() + 1).padStart(2, '0');
      const day = String(localTime.getDate()).padStart(2, '0');
      const monthDay = `${month}-${day}`;

      this.logger.log(`Birthday check: Looking for ${monthDay}`);

      const allMembers = await this.memberModel.find({ status: 'active', isActive: true }).exec();
      result.membersChecked = allMembers.length;

      const matches: any[] = [];
      for (const member of allMembers) {
        if (!member.birthday) continue;

        const bday = member.birthday.trim();

        if (
          bday.includes(monthDay) ||
          bday.endsWith(`-${month}-${day}`) ||
          bday.includes(`${day}/${month}`) ||
          bday.includes(`${month}/${day}`)
        ) {
          this.logger.log(`✓ Birthday match: ${member.name}`);
          matches.push(member);
        }
      }

      result.matchesFound = matches.length;

      for (const member of matches) {
        await this.sendBirthdayEmail(member);
        result.processed.push({
          name: member.name,
          email: member.email || 'N/A',
          status: 'sent',
        });
      }

      result.success = true;
      result.message = `Birthday wishes sent to ${matches.length} member(s)`;
      this.logger.log(`✅ ${result.message}`);
    } catch (err: any) {
      result.success = false;
      result.message = `Error: ${err?.message || 'Unknown error'}`;
      result.errors.push(err?.message || 'Unknown error');
      this.logger.error(`Birthday check error: ${err?.message}`);
    }
  }

  private async sendBirthdayEmail(member: MemberDocument) {
    const name = member.name.split(' ')[0];

    const serviceId = this.config.get<string>('EMAILJS_SERVICE_ID');
    const templateId = this.config.get<string>('EMAILJS_TEMPLATE_ID');
    const userId = this.config.get<string>('EMAILJS_PUBLIC_KEY');
    const privateKey = this.config.get<string>('EMAILJS_PRIVATE_KEY');

    if (!serviceId || !templateId || !userId || !privateKey) {
      this.logger.error('EmailJS config missing');
      return;
    }

    if (!member.email) {
      this.logger.log(`No email for member ${member.name}`);
      return;
    }

    try {
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
              .confetti { font-size: 2rem; display: inline-block; margin: 0 4px; }
              .header h1 { margin: 0; font-size: 3rem; color: #fff; font-weight: 800; letter-spacing: -1px; }
              .header p { margin: 8px 0 0 0; color: rgba(255,255,255,0.9); font-size: 1.1rem; }
              .content { padding: 40px 30px; background: rgba(255,255,255,0.08); color: #fff; }
              .greeting { font-size: 1.3rem; margin: 0 0 20px 0; font-weight: 600; }
              .message { font-size: 0.95rem; line-height: 1.8; margin: 0 0 20px 0; color: rgba(255,255,255,0.95); }
              .highlight { background: rgba(255,255,255,0.15); padding: 20px; border-radius: 12px; border-left: 4px solid #ffd700; margin: 20px 0; font-style: italic; }
              .cta-button { display: inline-block; background: #ffd700; color: #667eea; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 0.95rem; margin: 20px 0; }
              .footer { background: rgba(0,0,0,0.15); padding: 25px 30px; text-align: center; font-size: 0.85rem; color: rgba(255,255,255,0.7); border-top: 1px solid rgba(255,255,255,0.1); }
              .footer-text { margin: 0; }
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
                  <div class="highlight">
                    "May your birthday be filled with joy, laughter, and wonderful memories. Here's to another year of health, happiness, and endless possibilities!"
                  </div>
                  <p class="message">
                    Thank you for being an integral part of our alumni family. Your presence and contributions mean so much to all of us. We're grateful for the bond we share as members of the Class of 2018.
                  </p>
                  <p class="message" style="text-align: center;">
                    <strong>Wishing you the very best on your special day! 🌟</strong>
                  </p>
                </div>
                <div class="footer">
                  <p class="footer-text">
                    <strong>IDAGHA Secondary School</strong><br>
                    Class of 2018 Alumni Association
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;

      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: userId,
          accessToken: privateKey,
          template_params: { to_email: member.email, subject: `🎂 Happy Birthday, ${name}! 🎂`, html },
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        this.logger.error(`Email failed (${res.status}): ${error}`);
        return;
      }

      this.logger.log(`✓ Birthday email sent to ${member.email}`);
    } catch (err: any) {
      this.logger.error(`Email error: ${err.message}`);
    }
  }
}
