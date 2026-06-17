import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';

import { ReunionFund, ReunionFundDocument } from './reunion-fund.schema';
import { Contribution, ContributionDocument } from '../contributions/contribution.schema';
import { Member, MemberDocument } from '../members/member.schema';
import { Wallet, WalletDocument } from '../wallets/wallet.schema';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class ReunionFundService {
  private readonly logger = new Logger(ReunionFundService.name);

  constructor(
    @InjectModel(ReunionFund.name) private model: Model<ReunionFundDocument>,
    @InjectModel(Contribution.name) private contribModel: Model<ContributionDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    private config: ConfigService,
    private wa: WhatsappService,
  ) {}

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) throw new Error('RESEND_API_KEY environment variable is not set.');

    const from = this.config.get<string>('MAIL_FROM') || 'IDAGHA Alumni <onboarding@resend.dev>';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).message || `Resend API error ${res.status}`);
    }
  }

  async get() {
    let fund = await this.model.findOne({ isActive: true }).exec();
    if (!fund) {
      fund = await this.model.create({
        title: 'Idagha 2026 Reunion Fund',
        targetAmount: 3000000,
        raisedAmount: 0,
        memberTarget: 10000,
        totalMembers: 0,
        targetDate: new Date('2026-12-31'),
        description: 'Each member contributes ₦10,000 (part-payment allowed). Funds go toward the 2026 reunion event.',
        isActive: true,
      });
    }

    // Find the reunion wallet so we can match by walletId too
    const reunionWallet = await this.walletModel.findOne({ type: 'reunion' }).lean().exec();
    const reunionWalletId = reunionWallet ? (reunionWallet as any)._id.toString() : null;

    // Match contributions by category OR by reunion wallet — whichever the admin used
    const matchQuery: any = {
      $or: [{ category: 'reunion-fund' }],
    };
    if (reunionWalletId) matchQuery.$or.push({ walletId: reunionWalletId });

    const result = await this.contribModel.aggregate([
      { $match: matchQuery },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const raisedAmount = result[0]?.total || 0;

    return { ...fund.toObject(), raisedAmount };
  }

  async update(data: Partial<ReunionFund>) {
    const fund = await this.get();
    return this.model.findByIdAndUpdate(fund._id, data, { new: true }).exec();
  }

  async getMemberBreakdown() {
    const fund = await this.get();
    const memberTarget = fund.memberTarget || 10000;

    // All active members
    const allMembers = await this.memberModel
      .find({ status: 'active' })
      .sort({ name: 1 })
      .lean()
      .exec();

    // Match contributions by category OR by reunion wallet
    const reunionWallet = await this.walletModel.findOne({ type: 'reunion' }).lean().exec();
    const reunionWalletId = reunionWallet ? (reunionWallet as any)._id.toString() : null;
    const contribQuery: any = { $or: [{ category: 'reunion-fund' }] };
    if (reunionWalletId) contribQuery.$or.push({ walletId: reunionWalletId });

    const contribs = await this.contribModel
      .find(contribQuery)
      .sort({ date: 1 })
      .exec();

    // Group contributions by contributor name
    const byName: Record<string, { total: number; payments: { amount: number; date: Date }[] }> = {};
    for (const c of contribs) {
      const key = c.contributorName.trim();
      if (!byName[key]) byName[key] = { total: 0, payments: [] };
      byName[key].total += c.amount;
      byName[key].payments.push({ amount: c.amount, date: c.date });
    }

    // Merge with all active members so everyone appears (even those who haven't paid)
    const memberRows = allMembers.map((m) => {
      const data = byName[m.name.trim()] || { total: 0, payments: [] };
      return {
        name: m.name,
        email: m.email || '',
        paid: data.total,
        remaining: Math.max(0, memberTarget - data.total),
        percentage: Math.min(100, Math.round((data.total / memberTarget) * 100)),
        completed: data.total >= memberTarget,
        payments: data.payments,
      };
    });

    // Also include contributors not in the members list (manual entries)
    for (const [name, data] of Object.entries(byName)) {
      const exists = memberRows.find((m) => m.name.trim() === name);
      if (!exists) {
        memberRows.push({
          name,
          email: '',
          paid: data.total,
          remaining: Math.max(0, memberTarget - data.total),
          percentage: Math.min(100, Math.round((data.total / memberTarget) * 100)),
          completed: data.total >= memberTarget,
          payments: data.payments,
        });
      }
    }

    memberRows.sort((a, b) => b.paid - a.paid);

    return {
      memberTarget,
      members: memberRows,
      completedCount: memberRows.filter((m) => m.completed).length,
      totalMembers: memberRows.length,
    };
  }

  // Runs every Monday at 8:00 AM — sends reminders to all members with incomplete payment
  @Cron('0 8 * * 1')
  async weeklyReminder() {
    this.logger.log('Running weekly reunion fund reminder...');
    const result = await this.sendReminders();
    this.logger.log(`Weekly reminder done — sent: ${result.sent}, failed: ${result.failed.length}, no email: ${result.noEmail.length}`);
  }

  // Send reminder emails to incomplete members
  async sendReminders(memberNames?: string[]): Promise<{ sent: number; failed: string[]; noEmail: string[] }> {
    const fund = await this.get();
    const breakdown = await this.getMemberBreakdown();
    const memberTarget = breakdown.memberTarget;

    // Filter to incomplete members, optionally specific ones
    let targets = breakdown.members.filter((m) => !m.completed);
    if (memberNames && memberNames.length > 0) {
      targets = targets.filter((m) => memberNames.includes(m.name));
    }

    let sent = 0;
    const failed: string[] = [];
    const noEmail: string[] = [];

    for (const member of targets) {
      if (!member.email) {
        noEmail.push(member.name);
        continue;
      }

      const paidFormatted = `₦${member.paid.toLocaleString()}`;
      const remainingFormatted = `₦${member.remaining.toLocaleString()}`;
      const targetFormatted = `₦${memberTarget.toLocaleString()}`;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .wrap { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #15803d, #22c55e); padding: 32px 32px 24px; text-align: center; }
    .header h1 { color: #fff; margin: 0 0 6px; font-size: 1.4rem; }
    .header p { color: rgba(255,255,255,0.85); margin: 0; font-size: 0.9rem; }
    .body { padding: 32px; }
    .greeting { font-size: 1.05rem; color: #111; margin-bottom: 16px; }
    .amount-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px 24px; margin: 20px 0; }
    .amount-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .amount-row:last-child { margin-bottom: 0; }
    .amount-label { color: #6b7280; font-size: 0.85rem; }
    .amount-value { font-weight: 700; font-size: 1rem; color: #111; }
    .amount-value.green { color: #16a34a; }
    .amount-value.red { color: #dc2626; }
    .progress-bar { background: #e5e7eb; border-radius: 99px; height: 10px; margin: 16px 0 8px; }
    .progress-fill { background: linear-gradient(90deg, #16a34a, #22c55e); border-radius: 99px; height: 100%; }
    .progress-label { font-size: 0.8rem; color: #6b7280; text-align: right; }
    .cta { text-align: center; margin: 28px 0 12px; }
    .cta a { background: linear-gradient(135deg, #15803d, #22c55e); color: #fff; padding: 13px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 0.95rem; display: inline-block; }
    .footer { padding: 20px 32px; background: #f9fafb; text-align: center; font-size: 0.78rem; color: #9ca3af; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>IDAGHA Class of 2018 Alumni</h1>
      <p>2026 Reunion Fund — Payment Reminder</p>
    </div>
    <div class="body">
      <p class="greeting">Dear <strong>${member.name}</strong>,</p>
      <p style="color:#374151;line-height:1.7;">
        This is a friendly reminder that your <strong>2026 Reunion Fund</strong> contribution is not yet complete.
        Each member is expected to contribute <strong>${targetFormatted}</strong> (part-payment is allowed at any time).
      </p>

      <div class="amount-box">
        <div class="amount-row">
          <span class="amount-label">Required amount</span>
          <span class="amount-value">${targetFormatted}</span>
        </div>
        <div class="amount-row">
          <span class="amount-label">You have paid</span>
          <span class="amount-value green">${paidFormatted}</span>
        </div>
        <div class="amount-row">
          <span class="amount-label">Balance remaining</span>
          <span class="amount-value red">${remainingFormatted}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${member.percentage}%"></div>
        </div>
        <div class="progress-label">${member.percentage}% completed</div>
      </div>

      <p style="color:#374151;line-height:1.7;">
        Please make your payment or part-payment as soon as possible to help us reach our goal.
        Contact the Secretary for payment details.
      </p>

      <div class="cta">
        <a href="https://idagha2018alumni-beta.vercel.app/reunion-fund">View Reunion Fund Progress</a>
      </div>

      <p style="color:#6b7280;font-size:0.85rem;line-height:1.6;">
        If you have already made a payment that is not reflected above, please inform the Secretary with your payment proof.
      </p>
    </div>
    <div class="footer">
      IDAGHA Secondary School Class of 2018 Alumni &bull; Financial Transparency Portal<br>
      This is an automated reminder sent by the Secretary.
    </div>
  </div>
</body>
</html>`;

      try {
        await this.sendEmail(
          member.email,
          `Reminder: Complete Your 2026 Reunion Fund Payment — ${remainingFormatted} remaining`,
          html,
        );
        sent++;
      } catch (err: any) {
        this.logger.error(`Failed to send email to ${member.name} (${member.email}): ${err.message}`);
        failed.push(member.name);
      }
    }

    return { sent, failed, noEmail };
  }

  async sendWhatsappReminders(memberNames?: string[]): Promise<{ sent: number; failed: string[]; noWhatsapp: string[] }> {
    if (!this.wa.isReady()) {
      throw new Error('WhatsApp is not connected. Please scan the QR code at GET /api/whatsapp/qr first.');
    }

    const breakdown = await this.getMemberBreakdown();
    const memberTarget = breakdown.memberTarget;

    let targets = breakdown.members.filter((m) => !m.completed);
    if (memberNames && memberNames.length > 0) {
      targets = targets.filter((m) => memberNames.includes(m.name));
    }

    // We need the whatsapp field from the members collection
    const allMembers = await this.memberModel.find({ status: 'active' }).lean().exec();
    const phoneByName: Record<string, string> = {};
    for (const m of allMembers) {
      const phone = (m as any).whatsapp || (m as any).phone || '';
      if (phone) phoneByName[m.name.trim()] = phone.trim();
    }

    let sent = 0;
    const failed: string[] = [];
    const noWhatsapp: string[] = [];

    for (const member of targets) {
      const phone = phoneByName[member.name.trim()];
      if (!phone) {
        noWhatsapp.push(member.name);
        continue;
      }

      const paidFormatted = `₦${member.paid.toLocaleString()}`;
      const remainingFormatted = `₦${member.remaining.toLocaleString()}`;
      const targetFormatted = `₦${memberTarget.toLocaleString()}`;

      const message =
        `*IDAGHA Class of 2018 Alumni*\n` +
        `_2026 Reunion Fund — Payment Reminder_\n\n` +
        `Dear *${member.name}*,\n\n` +
        `This is a friendly reminder that your Reunion Fund contribution is not yet complete.\n\n` +
        `📋 *Your Payment Status:*\n` +
        `• Required: *${targetFormatted}*\n` +
        `• Paid so far: *${paidFormatted}*\n` +
        `• Balance: *${remainingFormatted}* (${member.percentage}% done)\n\n` +
        `Please make your payment or part-payment as soon as possible.\n` +
        `Contact the Secretary for payment details.\n\n` +
        `🔗 View progress: https://idagha2018alumni-beta.vercel.app/reunion-fund`;

      try {
        await this.wa.sendMessage(phone, message);
        sent++;
      } catch (err: any) {
        this.logger.error(`Failed to send WhatsApp to ${member.name} (${phone}): ${err.message}`);
        failed.push(member.name);
      }
    }

    return { sent, failed, noWhatsapp };
  }
}
