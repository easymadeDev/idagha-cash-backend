import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { randomBytes } from 'crypto';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ContributionsService } from './contributions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { Wallet, WalletDocument } from '../wallets/wallet.schema';
import { Member, MemberDocument } from '../members/member.schema';

class CreateContributionDto {
  @IsString()
  contributorName: string;

  @Type(() => Number)
  @IsNumber()
  amount: number;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  walletId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

@Controller('contributions')
export class ContributionsController {
  private readonly logger = new Logger(ContributionsController.name);

  constructor(
    private service: ContributionsService,
    private config: ConfigService,
    @InjectModel(Wallet.name) private walletModel: Model<WalletDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
  ) {}

  private async sendMail(to: string, subject: string, html: string) {
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
        this.logger.error(`EmailJS error sending to ${to}: ${err}`);
      }
    } catch (err: any) {
      this.logger.error(`EmailJS fetch failed: ${err.message}`);
    }
  }

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Public endpoint only returns approved contributions
    return this.service.findAll(search, startDate, endDate, 'approved');
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/all')
  findAllAdmin(
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Admin endpoint returns all contributions (pending + approved)
    return this.service.findAll(search, startDate, endDate);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post('pending')
  @UseInterceptors(FileInterceptor('receipt', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = './uploads';
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        cb(null, `${randomBytes(16).toString('hex')}${extname(file.originalname)}`);
      },
    }),
  }))
  async createPending(@Body() body: any, @UploadedFile() file: Express.Multer.File) {
    const data: any = { ...body, status: 'pending', amount: Number(body.amount) };
    if (body.date) data.date = new Date(body.date);
    else data.date = new Date();
    if (file) {
      data.receiptUrl = `/uploads/${file.filename}`;
    }
    const contribution = await this.service.create(data);

    // Notify admin of new pending contribution
    const adminEmail = this.config.get<string>('ADMIN_EMAIL') || this.config.get<string>('MAIL_USER') || '';
    if (adminEmail) {
      const name = body.contributorName || 'Unknown';
      const amount = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(body.amount));
      const dateStr = data.date ? new Date(data.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A';
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
.wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)}
.hdr{background:linear-gradient(135deg,#15803d,#22c55e);padding:32px 32px 24px;text-align:center}
.hdr h1{color:#fff;margin:0 0 6px;font-size:1.35rem}
.hdr p{color:rgba(255,255,255,.85);margin:0;font-size:.88rem}
.body{padding:32px}
p{color:#374151;line-height:1.7;margin:0 0 14px}
.box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px 22px;margin:18px 0}
.row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.row:last-child{margin-bottom:0}
.lbl{color:#6b7280;font-size:.84rem}
.val{font-weight:700;color:#111;font-size:.93rem}
.badge-yellow{display:inline-block;padding:5px 14px;border-radius:99px;font-size:.8rem;font-weight:700;background:#fef9c3;color:#92400e}
.cta{text-align:center;margin:24px 0 8px}
.cta a{background:linear-gradient(135deg,#15803d,#22c55e);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:.9rem;display:inline-block}
.ftr{padding:18px 32px;background:#f9fafb;text-align:center;font-size:.76rem;color:#9ca3af;border-top:1px solid #e5e7eb}
</style></head><body><div class="wrap">
<div class="hdr"><h1>IDAGHA Class of 2018 Alumni</h1><p>New Contribution — Pending Approval</p></div>
<div class="body">
<p>A new contribution has been submitted and is waiting for your approval.</p>
<div class="box">
  <div class="row"><span class="lbl">Contributor</span><span class="val">${name}</span></div>
  <div class="row"><span class="lbl">Amount</span><span class="val" style="color:#15803d">${amount}</span></div>
  <div class="row"><span class="lbl">Date</span><span class="val">${dateStr}</span></div>
  ${body.note ? `<div class="row"><span class="lbl">Note</span><span class="val">${body.note}</span></div>` : ''}
  ${body.email ? `<div class="row"><span class="lbl">Email</span><span class="val">${body.email}</span></div>` : ''}
  ${body.phone ? `<div class="row"><span class="lbl">Phone</span><span class="val">${body.phone}</span></div>` : ''}
  <div class="row"><span class="lbl">Status</span><span class="badge-yellow">Pending Approval</span></div>
</div>
<p>Log in to the Admin Portal to review and approve or reject this contribution.</p>
<div class="cta"><a href="https://idagha2018alumni-beta.vercel.app/admin/contributions">Review Contributions</a></div>
</div>
<div class="ftr">IDAGHA Secondary School Class of 2018 Alumni &bull; Financial Transparency Portal</div>
</div></body></html>`;
      this.sendMail(adminEmail, `New Contribution: ${name} — ${amount} (Pending Approval)`, html).catch(() => {});
    }

    return contribution;
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: CreateContributionDto) {
    return this.service.create({ ...body, date: new Date(body.date) });
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body() body: { walletId: string; category?: string; memberId?: string },
  ) {
    // Fetch the pending contribution
    const contribution = await this.service.findOne(id);

    // Build update payload — assign walletId, memberId, category, status
    const updateData: any = {
      status: 'approved',
      walletId: body.walletId,
    };
    if (body.category) updateData.category = body.category;
    if (body.memberId) updateData.memberId = body.memberId;

    const updated = await this.service.update(id, updateData);

    // Fetch wallet name for the email
    let walletName = 'Group Wallet';
    try {
      const wallet = await this.walletModel.findById(body.walletId).exec();
      if (wallet) walletName = wallet.name;
    } catch (_) {}

    // Fetch member email if memberId provided
    let memberEmail = (contribution as any).email || '';
    if (body.memberId && !memberEmail) {
      try {
        const member = await this.memberModel.findById(body.memberId).exec();
        if (member?.email) memberEmail = member.email;
      } catch (_) {}
    }

    const amount = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format((contribution as any).amount);
    const name = (contribution as any).contributorName;
    const adminEmail = this.config.get<string>('ADMIN_EMAIL') || this.config.get<string>('MAIL_USER') || '';

    const tpl = (body: string) => `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px}
.wrap{max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08)}
.hdr{background:linear-gradient(135deg,#15803d,#22c55e);padding:32px 32px 24px;text-align:center}
.hdr h1{color:#fff;margin:0 0 6px;font-size:1.35rem}
.hdr p{color:rgba(255,255,255,.85);margin:0;font-size:.88rem}
.body{padding:32px}
p{color:#374151;line-height:1.7;margin:0 0 14px}
.box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px 22px;margin:18px 0}
.row{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.row:last-child{margin-bottom:0}
.lbl{color:#6b7280;font-size:.84rem}
.val{font-weight:700;color:#111;font-size:.93rem}
.badge-green{display:inline-block;padding:5px 14px;border-radius:99px;font-size:.8rem;font-weight:700;background:#dcfce7;color:#15803d}
.ftr{padding:18px 32px;background:#f9fafb;text-align:center;font-size:.76rem;color:#9ca3af;border-top:1px solid #e5e7eb}
</style></head><body><div class="wrap">${body}</div></body></html>`;

    if (memberEmail) {
      const html = tpl(`
<div class="hdr"><h1>IDAGHA Class of 2018 Alumni</h1><p>Contribution Approved ✓</p></div>
<div class="body">
<p>Dear <strong>${name}</strong>,</p>
<p>Great news! Your contribution has been <strong style="color:#15803d">verified and approved</strong> by the Secretary and is now showing publicly on the portal.</p>
<div class="box">
  <div class="row"><span class="lbl">Contributor</span><span class="val">${name}</span></div>
  <div class="row"><span class="lbl">Amount</span><span class="val" style="color:#15803d">${amount}</span></div>
  <div class="row"><span class="lbl">Wallet</span><span class="val">${walletName}</span></div>
  <div class="row"><span class="lbl">Status</span><span class="badge-green">Approved</span></div>
</div>
<p>Thank you for your support to the IDAGHA Alumni family. Your contribution has been recorded and will count toward our group goals.</p>
</div>
<div class="ftr">IDAGHA Secondary School Class of 2018 Alumni &bull; Financial Transparency Portal</div>`);
      this.sendMail(memberEmail, `Your Contribution of ${amount} Has Been Approved — IDAGHA Alumni`, html).catch(() => {});
    }

    if (adminEmail) {
      const html = tpl(`
<div class="hdr"><h1>IDAGHA Class of 2018 Alumni</h1><p>Contribution Approved — Admin Log</p></div>
<div class="body">
<p>You have successfully approved a contribution. Here is the record:</p>
<div class="box">
  <div class="row"><span class="lbl">Contributor</span><span class="val">${name}</span></div>
  <div class="row"><span class="lbl">Amount</span><span class="val" style="color:#15803d">${amount}</span></div>
  <div class="row"><span class="lbl">Wallet Credited</span><span class="val">${walletName}</span></div>
  <div class="row"><span class="lbl">Status</span><span class="badge-green">Approved</span></div>
</div>
<p>The wallet balance has been updated accordingly.</p>
</div>
<div class="ftr">IDAGHA Secondary School Class of 2018 Alumni &bull; Admin Portal</div>`);
      this.sendMail(adminEmail, `Contribution Approved: ${name} — ${amount}`, html).catch(() => {});
    }

    return updated;
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: Partial<CreateContributionDto>) {
    const data: any = { ...body };
    if (body.date) data.date = new Date(body.date);
    return this.service.update(id, data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
