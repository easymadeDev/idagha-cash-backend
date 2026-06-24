import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { Pledge, PledgeDocument } from './pledge.schema';
import { Member, MemberDocument } from '../members/member.schema';
import { Contribution, ContributionDocument } from '../contributions/contribution.schema';
import { Wallet, WalletDocument } from '../wallets/wallet.schema';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class PledgesService {
  private readonly logger = new Logger(PledgesService.name);

  constructor(
    @InjectModel(Pledge.name) private model: Model<PledgeDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    @InjectModel(Contribution.name) private contribModel: Model<ContributionDocument>,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    private config: ConfigService,
    private wa: WhatsappService,
  ) {}

  // ── email helper ───────────────────────────────────────────────────────────

  private async sendEmail(to: string, subject: string, html: string) {
    const serviceId = this.config.get<string>('EMAILJS_SERVICE_ID');
    const templateId = this.config.get<string>('EMAILJS_TEMPLATE_ID');
    const userId = this.config.get<string>('EMAILJS_PUBLIC_KEY');
    const privateKey = this.config.get<string>('EMAILJS_PRIVATE_KEY');
    if (!serviceId || !templateId || !userId || !privateKey) {
      this.logger.warn('EmailJS env vars not set — skipping email');
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
        const err = await res.text().catch(() => '');
        this.logger.error(`EmailJS error to ${to}: ${err}`);
      }
    } catch (err: any) {
      this.logger.error(`EmailJS fetch failed: ${err.message}`);
    }
  }

  // ── email templates ────────────────────────────────────────────────────────

  private wrap(body: string) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
.wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)}
.hdr{background:linear-gradient(135deg,#7c3aed,#a855f7);padding:32px 32px 24px;text-align:center}
.hdr h1{color:#fff;margin:0 0 6px;font-size:1.35rem}
.hdr p{color:rgba(255,255,255,.85);margin:0;font-size:.88rem}
.body{padding:32px}
p{color:#374151;line-height:1.7;margin:0 0 14px}
.box{background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:18px 22px;margin:18px 0}
.row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.row:last-child{margin-bottom:0}
.lbl{color:#6b7280;font-size:.84rem}
.val{font-weight:700;color:#111;font-size:.93rem}
.badge{display:inline-block;padding:5px 14px;border-radius:99px;font-size:.8rem;font-weight:700}
.badge-pending{background:#fef9c3;color:#92400e}
.badge-fulfilled{background:#dcfce7;color:#15803d}
.progress-bar{background:#e5e7eb;border-radius:99px;height:10px;margin:16px 0 8px}
.progress-fill{background:linear-gradient(90deg,#7c3aed,#a855f7);border-radius:99px;height:100%}
.ftr{padding:18px 32px;background:#f9fafb;text-align:center;font-size:.76rem;color:#9ca3af;border-top:1px solid #e5e7eb}
</style></head><body><div class="wrap">${body}</div></body></html>`;
  }

  private pledgeCreatedHtml(pledge: PledgeDocument, addedByAdmin: boolean) {
    const amt = `₦${pledge.amount.toLocaleString()}`;
    const due = pledge.dueDate ? new Date(pledge.dueDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : 'No deadline set';
    return this.wrap(`
<div class="hdr"><h1>IDAGHA Class of 2018 Alumni</h1><p>Reunion Support — Confirmed</p></div>
<div class="body">
<p>Dear <strong>${pledge.memberName}</strong>,</p>
<p>${addedByAdmin ? 'The admin has recorded a reunion support on your behalf for the <strong>2026 Reunion Fund</strong>.' : 'Your reunion support for the <strong>2026 Reunion Fund</strong> has been recorded.'} Thank you for your commitment!</p>
<div class="box">
  <div class="row"><span class="lbl">Support Amount</span><span class="val">${amt}</span></div>
  <div class="row"><span class="lbl">Due Date</span><span class="val">${due}</span></div>
  <div class="row"><span class="lbl">Status</span><span class="val"><span class="badge badge-pending">Pending</span></span></div>
  ${pledge.note ? `<div class="row"><span class="lbl">Note</span><span class="val">${pledge.note}</span></div>` : ''}
</div>
<p>Once your payment is received and confirmed by the admin, your reunion support will be marked as <strong>Fulfilled</strong> and moved to the Reunion Fund.</p>
</div>
<div class="ftr">IDAGHA Secondary School Class of 2018 Alumni &bull; Reunion Support System</div>`);
  }

  private pledgeFulfilledHtml(pledge: PledgeDocument) {
    const amt = `₦${pledge.amount.toLocaleString()}`;
    return this.wrap(`
<div class="hdr"><h1>IDAGHA Class of 2018 Alumni</h1><p>Reunion Support — Fulfilled!</p></div>
<div class="body">
<p>Dear <strong>${pledge.memberName}</strong>,</p>
<p>Great news! Your reunion support of <strong>${amt}</strong> for the <strong>2026 Reunion Fund</strong> has been marked as <strong>fulfilled</strong>. Your contribution has been moved to the Reunion Fund Wallet.</p>
<div class="box">
  <div class="row"><span class="lbl">Amount</span><span class="val">${amt}</span></div>
  <div class="row"><span class="lbl">Status</span><span class="val"><span class="badge badge-fulfilled">Fulfilled</span></span></div>
  <div class="row"><span class="lbl">Date</span><span class="val">${new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
</div>
<p>Thank you for supporting the reunion! We look forward to seeing you in 2026.</p>
</div>
<div class="ftr">IDAGHA Secondary School Class of 2018 Alumni &bull; Reunion Support System</div>`);
  }

  private pledgeReminderHtml(pledge: PledgeDocument) {
    const amt = `₦${pledge.amount.toLocaleString()}`;
    const due = pledge.dueDate ? new Date(pledge.dueDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : 'No deadline set';
    return this.wrap(`
<div class="hdr"><h1>IDAGHA Class of 2018 Alumni</h1><p>Reunion Support — Reminder</p></div>
<div class="body">
<p>Dear <strong>${pledge.memberName}</strong>,</p>
<p>This is a friendly reminder that you have a pending reunion support of <strong>${amt}</strong> for the <strong>2026 Reunion Fund</strong>. Please make your payment at your earliest convenience.</p>
<div class="box">
  <div class="row"><span class="lbl">Pledged Amount</span><span class="val">${amt}</span></div>
  <div class="row"><span class="lbl">Due Date</span><span class="val">${due}</span></div>
  <div class="row"><span class="lbl">Status</span><span class="val"><span class="badge badge-pending">Pending</span></span></div>
</div>
<p>Please contact the Secretary for payment details.</p>
</div>
<div class="ftr">IDAGHA Secondary School Class of 2018 Alumni &bull; Reunion Support System</div>`);
  }

  private whatsappReminderText(pledge: PledgeDocument) {
    const amt = `₦${pledge.amount.toLocaleString()}`;
    const due = pledge.dueDate ? new Date(pledge.dueDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : 'No deadline set';
    return (
      `🎓 *IDAGHA Secondary School*\n*Class of 2018 Alumni*\n━━━━━━━━━━━━━━━━━━\n\n` +
      `Dear *${pledge.memberName}*,\n\n` +
      `This is a reminder about your pending *Reunion Fund Support*.\n\n` +
      `📋 *Support Details:*\n` +
      `• Amount: *${amt}*\n` +
      `• Due: *${due}*\n` +
      `• Status: ⏳ Pending\n\n` +
      `Please make your payment at your earliest convenience and inform the Secretary.\n\n` +
      `━━━━━━━━━━━━━━━━━━\n_IDAGHA 2018 Alumni Portal_`
    );
  }

  private whatsappCreatedText(pledge: PledgeDocument, addedByAdmin: boolean) {
    const amt = `₦${pledge.amount.toLocaleString()}`;
    return (
      `🎓 *IDAGHA Secondary School*\n*Class of 2018 Alumni*\n━━━━━━━━━━━━━━━━━━\n\n` +
      `Dear *${pledge.memberName}*,\n\n` +
      (addedByAdmin
        ? `The admin has recorded a *Reunion Fund Support* of *${amt}* on your behalf.`
        : `Your *Reunion Fund Support* of *${amt}* has been recorded.`) +
      `\n\nOnce your payment is confirmed, it will be moved to the Reunion Fund. Thank you! 🙏\n\n` +
      `━━━━━━━━━━━━━━━━━━\n_IDAGHA 2018 Alumni Portal_`
    );
  }

  private whatsappFulfilledText(pledge: PledgeDocument) {
    const amt = `₦${pledge.amount.toLocaleString()}`;
    return (
      `🎓 *IDAGHA Secondary School*\n*Class of 2018 Alumni*\n━━━━━━━━━━━━━━━━━━\n\n` +
      `Dear *${pledge.memberName}*, 🎉\n\n` +
      `Your reunion support of *${amt}* has been *fulfilled* and moved to the Reunion Fund!\n\n` +
      `Thank you for your support. We look forward to seeing you in 2026! 🎊\n\n` +
      `━━━━━━━━━━━━━━━━━━\n_IDAGHA 2018 Alumni Portal_`
    );
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async findAll(status?: string) {
    const filter: any = {};
    if (status) filter.status = status;
    return this.model.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Pledge not found');
    return doc;
  }

  async create(data: {
    memberName: string;
    memberEmail?: string;
    memberPhone?: string;
    memberId?: string;
    amount: number;
    note?: string;
    dueDate?: string;
    addedBy?: string;
  }) {
    const pledge = await this.model.create({
      memberName: data.memberName,
      memberEmail: data.memberEmail || '',
      memberPhone: data.memberPhone || '',
      memberId: data.memberId || null,
      amount: data.amount,
      note: data.note || '',
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      addedBy: data.addedBy || 'self',
      status: 'pending',
    });

    const addedByAdmin = data.addedBy === 'admin';

    // notify via email
    if (pledge.memberEmail) {
      this.sendEmail(
        pledge.memberEmail,
        `Your Reunion Fund Support of ₦${pledge.amount.toLocaleString()} has been recorded`,
        this.pledgeCreatedHtml(pledge, addedByAdmin),
      ).catch(() => {});
    }

    // notify via WhatsApp
    if (this.wa.isReady() && pledge.memberPhone) {
      this.wa.sendMessage(pledge.memberPhone, this.whatsappCreatedText(pledge, addedByAdmin)).catch(() => {});
    }

    return pledge;
  }

  async update(id: string, data: Partial<{ memberName: string; memberEmail: string; memberPhone: string; amount: number; note: string; dueDate: string; status: string }>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
    if (!doc) throw new NotFoundException('Pledge not found');
    return doc;
  }

  async fulfill(id: string) {
    const promise = await this.findOne(id);
    if (promise.status === 'fulfilled') return promise;

    const updated = await this.model.findByIdAndUpdate(
      id,
      { status: 'fulfilled', fulfilledAt: new Date() },
      { new: true },
    ).exec();

    // Auto-create an approved contribution in the Reunion Fund Wallet
    try {
      const reunionWallet = await this.walletModel.findOne({ type: 'reunion' }).lean().exec();
      await this.contribModel.create({
        contributorName: promise.memberName,
        amount: promise.amount,
        date: new Date(),
        note: `Fulfilled reunion promise`,
        category: 'reunion-fund',
        walletId: reunionWallet ? (reunionWallet as any)._id.toString() : undefined,
        status: 'approved',
        email: promise.memberEmail || '',
        phone: promise.memberPhone || '',
        memberId: promise.memberId ? promise.memberId.toString() : undefined,
      });
      this.logger.log(`Auto-contribution created for fulfilled promise: ${promise.memberName} ₦${promise.amount}`);
    } catch (err: any) {
      this.logger.error(`Failed to create auto-contribution for promise ${id}: ${err.message}`);
    }

    // notify member
    if (updated!.memberEmail) {
      this.sendEmail(
        updated!.memberEmail,
        `Your Reunion Support of ₦${updated!.amount.toLocaleString()} is now Fulfilled!`,
        this.pledgeFulfilledHtml(updated!),
      ).catch(() => {});
    }
    if (this.wa.isReady() && updated!.memberPhone) {
      this.wa.sendMessage(updated!.memberPhone, this.whatsappFulfilledText(updated!)).catch(() => {});
    }

    return updated;
  }

  async remove(id: string) {
    const doc = await this.model.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Pledge not found');

    // If fulfilled, remove the auto-created contribution from the Reunion Fund Wallet
    if (doc.status === 'fulfilled') {
      try {
        await this.contribModel.deleteOne({
          contributorName: doc.memberName,
          amount: doc.amount,
          note: 'Fulfilled reunion promise',
          category: 'reunion-fund',
        }).exec();
        this.logger.log(`Removed auto-contribution for deleted fulfilled support: ${doc.memberName} ₦${doc.amount}`);
      } catch (err: any) {
        this.logger.error(`Failed to remove auto-contribution for support ${id}: ${err.message}`);
      }
    }

    return { message: 'Deleted successfully' };
  }

  // ── stats ──────────────────────────────────────────────────────────────────

  async getStats() {
    const all = await this.model.find().exec();
    const totalPledged = all.reduce((s, p) => s + p.amount, 0);
    const totalFulfilled = all.filter((p) => p.status === 'fulfilled').reduce((s, p) => s + p.amount, 0);
    const totalPending = all.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);
    return {
      totalPledged,
      totalFulfilled,
      totalPending,
      count: all.length,
      fulfilledCount: all.filter((p) => p.status === 'fulfilled').length,
      pendingCount: all.filter((p) => p.status === 'pending').length,
    };
  }

  // ── reminders ─────────────────────────────────────────────────────────────

  // Every Saturday at 8:00 AM — sends reminder to all pending pledgers
  @Cron('0 8 * * 6')
  async weekendReminder() {
    this.logger.log('Running weekend reunion support reminder...');
    const result = await this.sendReminders();
    this.logger.log(`Reunion support reminder done — sent: ${result.sent}, failed: ${result.failed.length}, noContact: ${result.noContact.length}`);
  }

  async sendReminders(pledgeIds?: string[]): Promise<{ sent: number; failed: string[]; noContact: string[] }> {
    let pledges: PledgeDocument[];
    if (pledgeIds && pledgeIds.length > 0) {
      pledges = await this.model.find({ _id: { $in: pledgeIds }, status: 'pending' }).exec();
    } else {
      pledges = await this.model.find({ status: 'pending' }).exec();
    }

    let sent = 0;
    const failed: string[] = [];
    const noContact: string[] = [];

    for (const pledge of pledges) {
      const hasEmail = !!pledge.memberEmail;
      const hasPhone = !!pledge.memberPhone;

      if (!hasEmail && !hasPhone) {
        noContact.push(pledge.memberName);
        continue;
      }

      let contacted = false;

      if (hasEmail) {
        try {
          await this.sendEmail(
            pledge.memberEmail,
            `Reminder: Your Reunion Support of ₦${pledge.amount.toLocaleString()} is still pending`,
            this.pledgeReminderHtml(pledge),
          );
          contacted = true;
        } catch (err: any) {
          this.logger.error(`Email reminder failed for ${pledge.memberName}: ${err.message}`);
          failed.push(pledge.memberName);
        }
      }

      if (this.wa.isReady() && hasPhone) {
        try {
          await this.wa.sendMessage(pledge.memberPhone, this.whatsappReminderText(pledge));
          contacted = true;
        } catch (err: any) {
          this.logger.error(`WhatsApp reminder failed for ${pledge.memberName}: ${err.message}`);
        }
      }

      if (contacted) sent++;
    }

    return { sent, failed, noContact };
  }
}
