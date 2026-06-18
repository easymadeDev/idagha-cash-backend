import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { Member, MemberDocument } from './member.schema';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    @InjectModel(Member.name) private model: Model<MemberDocument>,
    private config: ConfigService,
    private wa: WhatsappService,
  ) {}

  private async send(to: string, subject: string, html: string) {
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

  // ── email templates ────────────────────────────────────────────────────

  private tplWrap(body: string) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
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
.badge{display:inline-block;padding:5px 14px;border-radius:99px;font-size:.8rem;font-weight:700}
.badge-green{background:#dcfce7;color:#15803d}
.badge-yellow{background:#fef9c3;color:#92400e}
.ftr{padding:18px 32px;background:#f9fafb;text-align:center;font-size:.76rem;color:#9ca3af;border-top:1px solid #e5e7eb}
</style></head><body><div class="wrap">${body}</div></body></html>`;
  }

  // Admin: new registration arrived
  private mailAdminNewReg(member: MemberDocument) {
    const body = `
<div class="hdr"><h1>IDAGHA Class of 2018 Alumni</h1><p>New Member Registration — Pending Approval</p></div>
<div class="body">
<p>A new member has submitted a registration request and is waiting for your approval.</p>
<div class="box">
  <div class="row"><span class="lbl">Full Name</span><span class="val">${member.name}</span></div>
  ${member.email ? `<div class="row"><span class="lbl">Email</span><span class="val">${member.email}</span></div>` : ''}
  ${member.phone ? `<div class="row"><span class="lbl">Phone</span><span class="val">${member.phone}</span></div>` : ''}
  ${member.location ? `<div class="row"><span class="lbl">Location</span><span class="val">${member.location}</span></div>` : ''}
  ${member.occupation ? `<div class="row"><span class="lbl">Occupation</span><span class="val">${member.occupation}</span></div>` : ''}
  <div class="row"><span class="lbl">Status</span><span class="badge badge-yellow">Pending</span></div>
</div>
<p>Please log in to the Admin Portal to review and approve or reject this registration.</p>
</div>
<div class="ftr">IDAGHA Secondary School Class of 2018 Alumni &bull; Financial Transparency Portal</div>`;
    return this.tplWrap(body);
  }

  // Member: confirmation that their registration was received
  private mailMemberRegistered(member: MemberDocument) {
    const body = `
<div class="hdr"><h1>IDAGHA Class of 2018 Alumni</h1><p>Registration Received</p></div>
<div class="body">
<p>Dear <strong>${member.name}</strong>,</p>
<p>Thank you for registering with the <strong>IDAGHA Secondary School Class of 2018 Alumni</strong> portal. Your request has been received and is currently pending approval by the Secretary.</p>
<div class="box">
  <div class="row"><span class="lbl">Name</span><span class="val">${member.name}</span></div>
  ${member.phone ? `<div class="row"><span class="lbl">Phone</span><span class="val">${member.phone}</span></div>` : ''}
  <div class="row"><span class="lbl">Status</span><span class="badge badge-yellow">Pending Approval</span></div>
</div>
<p>You will receive another email once the Secretary reviews and approves your registration. If you have any questions, please contact the Secretary directly.</p>
</div>
<div class="ftr">IDAGHA Secondary School Class of 2018 Alumni &bull; Financial Transparency Portal</div>`;
    return this.tplWrap(body);
  }

  // Member: approval confirmation
  private mailMemberApproved(member: MemberDocument) {
    const body = `
<div class="hdr"><h1>IDAGHA Class of 2018 Alumni</h1><p>Registration Approved — Welcome!</p></div>
<div class="body">
<p>Dear <strong>${member.name}</strong>,</p>
<p>Great news! Your membership registration has been <strong style="color:#15803d">approved</strong> by the Secretary. You are now an active member of the <strong>IDAGHA Secondary School Class of 2018 Alumni</strong>.</p>
<div class="box">
  <div class="row"><span class="lbl">Name</span><span class="val">${member.name}</span></div>
  ${member.phone ? `<div class="row"><span class="lbl">Phone</span><span class="val">${member.phone}</span></div>` : ''}
  <div class="row"><span class="lbl">Status</span><span class="badge badge-green">Active Member</span></div>
</div>
<p>You can now access the alumni portal and verify your membership. Visit the portal to view all financial records, contributions, and upcoming reunion fund updates.</p>
<p style="text-align:center;margin-top:24px">
  <a href="https://idagha2018alumni-beta.vercel.app" style="background:linear-gradient(135deg,#15803d,#22c55e);color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:.93rem;display:inline-block">Visit the Portal</a>
</p>
<p style="color:#6b7280;font-size:.84rem;margin-top:16px">Welcome to the IDAGHA Class of 2018 family!</p>
</div>
<div class="ftr">IDAGHA Secondary School Class of 2018 Alumni &bull; Financial Transparency Portal</div>`;
    return this.tplWrap(body);
  }

  // ── service methods ────────────────────────────────────────────────────

  findAll() {
    return this.model.find({ isActive: true, status: { $ne: 'pending' } }).sort({ name: 1 }).exec();
  }

  findAllAdmin() {
    return this.model.find().sort({ createdAt: -1 }).exec();
  }

  async register(data: Partial<Member>) {
    if (data.phone) {
      const existing = await this.model.findOne({ phone: data.phone }).exec();
      if (existing) throw new ConflictException('A member with this phone number is already registered.');
    }
    const member = await this.model.create({ ...data, status: 'pending', isActive: false });

    // Fire-and-forget emails — don't block the response
    const adminEmail = this.config.get<string>('ADMIN_EMAIL') || this.config.get<string>('MAIL_USER') || '';
    if (adminEmail) {
      this.send(
        adminEmail,
        `New Member Registration: ${member.name} — Pending Approval`,
        this.mailAdminNewReg(member),
      ).catch(() => {});
    }

    if (member.email) {
      this.send(
        member.email,
        'Registration Received — IDAGHA Class of 2018 Alumni',
        this.mailMemberRegistered(member),
      ).catch(() => {});
    }

    return member;
  }

  create(data: Partial<Member>) {
    return this.model.create({ ...data, status: 'active', isActive: true });
  }

  async update(id: string, data: Partial<Member>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
    if (!doc) throw new NotFoundException('Member not found');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.model.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Member not found');
    return { message: 'Deleted' };
  }

  async approve(id: string) {
    const member = await this.update(id, { status: 'active', isActive: true });

    // Fire-and-forget approval email
    if (member.email) {
      this.send(
        member.email,
        'Your Membership Has Been Approved — IDAGHA Class of 2018 Alumni',
        this.mailMemberApproved(member),
      ).catch(() => {});
    }

    // Fire-and-forget WhatsApp welcome message
    const waPhone = (member as any).whatsapp || (member as any).phone;
    if (waPhone && this.wa.isReady()) {
      const msg =
        `🎉 Welcome, ${member.name}!\n\n` +
        `Your registration with the *IDAGHA Secondary School Class of 2018 Alumni* has been approved by the Secretary.\n\n` +
        `You are now an active member. Visit our portal to view contributions and reunion fund progress:\n` +
        `🔗 https://idagha2018alumni-beta.vercel.app\n\n` +
        `Welcome aboard! 🏫`;
      this.wa.sendMessage(waPhone, msg).catch(() => {});
    }

    return member;
  }

  async findById(id: string) {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Member not found');
    return doc;
  }

  async selfUpdate(id: string, data: any) {
    const allowed = ['nickname', 'phone', 'whatsapp', 'email', 'location', 'occupation', 'birthday', 'photo'];
    const clean: any = {};
    for (const key of allowed) {
      if (data[key] !== undefined) clean[key] = data[key];
    }
    const doc = await this.model.findByIdAndUpdate(id, clean, { new: true }).exec();
    if (!doc) throw new NotFoundException('Member not found');
    return doc;
  }

  async verify(query: string): Promise<{ found: boolean; member?: Partial<Member> }> {
    const q = query.trim();
    const doc = await this.model.findOne({
      status: 'active',
      $or: [
        { name:     { $regex: q, $options: 'i' } },
        { nickname: { $regex: q, $options: 'i' } },
        { phone:    { $regex: q.replace(/\s+/g, ''), $options: 'i' } },
        { whatsapp: { $regex: q.replace(/\s+/g, ''), $options: 'i' } },
        { email:    { $regex: `^${q}$`, $options: 'i' } },
      ],
    }).exec();

    if (!doc) return { found: false };
    const d = doc as any;
    const result: any = {
      found: true,
      member: { _id: d._id, name: d.name, nickname: d.nickname, photo: d.photo, position: d.position },
    };
    return result;
  }
}
