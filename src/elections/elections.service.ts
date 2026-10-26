import {
  Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException, Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Election, ElectionDocument, ELECTION_STATUSES } from './election.schema';
import { Nomination, NominationDocument } from './nomination.schema';
import { Vote, VoteDocument } from './vote.schema';
import { Member, MemberDocument } from '../members/member.schema';
import { Contribution, ContributionDocument } from '../contributions/contribution.schema';
import { WalletsService } from '../wallets/wallets.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

// Fields safe to show the public for a cleared candidate
const CANDIDATE_PUBLIC = '_id positionId positionTitle memberId memberName slogan manifesto photo';

@Injectable()
export class ElectionsService {
  private readonly logger = new Logger(ElectionsService.name);

  constructor(
    @InjectModel(Election.name) private model: Model<ElectionDocument>,
    @InjectModel(Nomination.name) private nominationModel: Model<NominationDocument>,
    @InjectModel(Vote.name) private voteModel: Model<VoteDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
    @InjectModel(Contribution.name) private contribModel: Model<ContributionDocument>,
    private wallets: WalletsService,
    private wa: WhatsappService,
  ) {}

  private notify(phone: string, message: string) {
    if (phone && this.wa.isReady()) this.wa.sendMessage(phone, message).catch(() => {});
  }

  private async getElection(id: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Election not found');
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Election not found');
    return doc;
  }

  private async getActiveMember(memberId: string) {
    const member = await this.memberModel.findById(memberId).exec();
    if (!member || member.status !== 'active' || !member.isActive) {
      throw new ForbiddenException('Only approved, active members can take part in elections');
    }
    return member;
  }

  private async makeReference() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < 5; i++) {
      let ref = 'IDG-';
      for (let j = 0; j < 6; j++) ref += chars[Math.floor(Math.random() * chars.length)];
      if (!(await this.nominationModel.exists({ reference: ref }))) return ref;
    }
    throw new ConflictException('Could not generate a form reference — please try again');
  }

  // ── Public ─────────────────────────────────────────────────────────────

  async findPublic() {
    const elections = await this.model.find({ status: { $ne: 'draft' } }).sort({ createdAt: -1 }).lean();
    const ids = elections.map((e) => e._id.toString());
    const counts = await this.nominationModel.aggregate([
      { $match: { electionId: { $in: ids }, applicationStatus: 'cleared' } },
      { $group: { _id: '$electionId', n: { $sum: 1 } } },
    ]);
    const byId = Object.fromEntries(counts.map((c) => [c._id, c.n]));
    return elections.map((e) => ({ ...e, candidateCount: byId[e._id.toString()] || 0 }));
  }

  async findOnePublic(id: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Election not found');
    const election = await this.model.findById(id).lean();
    if (!election || election.status === 'draft') throw new NotFoundException('Election not found');

    // Every paid aspirant gets a public campaign poster; cleared ones are the ballot
    const aspirants = await this.nominationModel
      .find({ electionId: id, paymentStatus: 'approved', applicationStatus: { $ne: 'disqualified' } })
      .select(`${CANDIDATE_PUBLIC} applicationStatus`).sort({ memberName: 1 }).lean();
    const candidates = aspirants.filter((a) => a.applicationStatus === 'cleared');

    const results = election.status === 'closed' ? await this.tally(id) : null;
    const totalVoters = await this.voteModel.distinct('memberId', { electionId: id }).then((v) => v.length);

    return {
      ...election,
      totalVoters,
      positions: election.positions.map((p: any) => {
        const pid = p._id.toString();
        const mine = aspirants.filter((a) => a.positionId === pid);
        return {
          ...p,
          aspirantCount: mine.length,
          aspirants: mine,
          candidates: candidates
            .filter((c) => c.positionId === pid)
            .map((c) => ({ ...c, votes: results ? results[pid]?.[c._id.toString()] || 0 : undefined })),
        };
      }),
    };
  }

  // votes per position per candidate: { [positionId]: { [candidateId]: count } }
  private async tally(electionId: string) {
    const rows = await this.voteModel.aggregate([
      { $match: { electionId } },
      { $group: { _id: { p: '$positionId', c: '$candidateId' }, n: { $sum: 1 } } },
    ]);
    const out: Record<string, Record<string, number>> = {};
    for (const r of rows) (out[r._id.p] = out[r._id.p] || {})[r._id.c] = r.n;
    return out;
  }

  // ── Member ─────────────────────────────────────────────────────────────

  async findMine(electionId: string, memberId: string) {
    const [forms, votes] = await Promise.all([
      this.nominationModel.find({ electionId, memberId }).select('-proofImage').sort({ createdAt: -1 }).lean(),
      this.voteModel.find({ electionId, memberId }).select('positionId candidateId').lean(),
    ]);
    return { forms, votes };
  }

  async buyForm(electionId: string, memberId: string, body: {
    positionId: string; payerName: string; proofImage: string; phone?: string; email?: string; note?: string;
  }) {
    const election = await this.getElection(electionId);
    if (election.status !== 'forms') throw new BadRequestException('Form sales are not open for this election');
    const position = election.positions.find((p) => p._id.toString() === body.positionId);
    if (!position) throw new NotFoundException('Position not found');
    if (!body.proofImage?.startsWith('data:image/') && !body.proofImage?.startsWith('data:application/pdf')) {
      throw new BadRequestException('Please attach your proof of payment');
    }

    const member = await this.getActiveMember(memberId);
    const existing = await this.nominationModel.findOne({
      electionId, positionId: body.positionId, memberId, paymentStatus: { $ne: 'rejected' },
    });
    if (existing) throw new ConflictException(`You already have a ${position.title} form (${existing.reference})`);

    const doc = await this.nominationModel.create({
      electionId,
      positionId: body.positionId,
      positionTitle: position.title,
      memberId,
      memberName: member.name,
      phone: body.phone || member.phone,
      email: body.email || member.email,
      amount: position.formPrice,
      reference: await this.makeReference(),
      payerName: body.payerName,
      proofImage: body.proofImage,
      note: body.note || '',
      photo: member.photo || '', // poster picture until they upload a campaign photo
    });

    this.notify(member.whatsapp || member.phone,
      `🗳️ *${election.title}*\n\nHi *${member.name}*, we received your payment proof for the *${position.title}* nomination form.\n\n` +
      `Reference: *${doc.reference}*\nAmount: ₦${position.formPrice.toLocaleString()}\n\n` +
      `The Secretary will confirm your payment shortly. — IDAGHA Class of 2018`);

    const { proofImage, ...rest } = doc.toObject();
    return rest;
  }

  async submitApplication(formId: string, memberId: string, body: { manifesto: string; slogan?: string; photo?: string }) {
    const form = await this.nominationModel.findById(formId).exec();
    if (!form || form.memberId !== memberId) throw new NotFoundException('Form not found');
    if (form.paymentStatus !== 'approved') throw new BadRequestException('Your payment has not been confirmed yet');
    if (form.applicationStatus === 'cleared' || form.applicationStatus === 'disqualified') {
      throw new BadRequestException('Screening is complete — this application can no longer be edited');
    }
    const election = await this.getElection(form.electionId);
    if (!['forms', 'screening'].includes(election.status)) {
      throw new BadRequestException('The application window for this election has closed');
    }
    if (!body.manifesto?.trim()) throw new BadRequestException('Please write your manifesto');

    form.manifesto = body.manifesto.trim();
    form.slogan = (body.slogan || '').trim();
    if (body.photo) form.photo = body.photo;
    if (!form.photo) {
      const member = await this.memberModel.findById(memberId).select('photo').lean();
      form.photo = member?.photo || '';
    }
    form.applicationStatus = 'submitted';
    await form.save();
    const { proofImage, ...rest } = form.toObject();
    return rest;
  }

  async vote(electionId: string, memberId: string, positionId: string, candidateId: string) {
    const election = await this.getElection(electionId);
    if (election.status !== 'voting') throw new BadRequestException('Voting is not open for this election');
    await this.getActiveMember(memberId);

    const candidate = await this.nominationModel.findById(candidateId).lean();
    if (!candidate || candidate.electionId !== electionId || candidate.positionId !== positionId
        || candidate.applicationStatus !== 'cleared') {
      throw new BadRequestException('Invalid candidate for this position');
    }

    try {
      await this.voteModel.create({ electionId, positionId, candidateId, memberId });
    } catch (err: any) {
      if (err.code === 11000) throw new ConflictException('You have already voted for this position');
      throw err;
    }
    return { ok: true, positionId, candidateId };
  }

  // ── Admin ──────────────────────────────────────────────────────────────

  findAllAdmin() {
    return this.model.find().sort({ createdAt: -1 }).exec();
  }

  create(data: Partial<Election>) {
    return this.model.create(data);
  }

  async update(id: string, data: Partial<Election>) {
    if (data.status && !ELECTION_STATUSES.includes(data.status)) throw new BadRequestException('Invalid status');
    const election = await this.getElection(id);
    // Keep subdocument ids stable so existing forms/votes still point at their positions
    if (data.positions) {
      const kept = new Set(data.positions.filter((p: any) => p._id).map((p: any) => p._id.toString()));
      const removed = election.positions.filter((p) => !kept.has(p._id.toString()));
      for (const p of removed) {
        if (await this.nominationModel.exists({ electionId: id, positionId: p._id.toString() })) {
          throw new BadRequestException(`"${p.title}" already has forms — it cannot be removed`);
        }
      }
    }
    Object.assign(election, data);
    return election.save();
  }

  // Deletes an election. With paid forms it needs `force`, and then also removes the
  // form-fee entries those payments added to the Group Wallet, so the books stay true.
  async remove(id: string, force = false) {
    await this.getElection(id);
    const paid = await this.nominationModel.find({ electionId: id, paymentStatus: 'approved' }).select('contributionId').lean();
    if (paid.length && !force) {
      throw new BadRequestException(`This election has ${paid.length} paid form(s). Confirm to delete them and their payment records too.`);
    }
    const contributionIds = paid.map((f) => f.contributionId).filter(Boolean);
    await Promise.all([
      this.model.findByIdAndDelete(id).exec(),
      this.nominationModel.deleteMany({ electionId: id }).exec(),
      this.voteModel.deleteMany({ electionId: id }).exec(),
      contributionIds.length ? this.contribModel.deleteMany({ _id: { $in: contributionIds } }).exec() : null,
    ]);
    return { message: 'Deleted', formsRemoved: paid.length, paymentsReversed: contributionIds.length };
  }

  // Deletes one nomination form: its votes go with it, and if it was paid,
  // the form-fee entry it added to the Group Wallet is removed.
  async removeForm(formId: string) {
    if (!isValidObjectId(formId)) throw new NotFoundException('Form not found');
    const form = await this.nominationModel.findById(formId).exec();
    if (!form) throw new NotFoundException('Form not found');
    const votes = await this.voteModel.deleteMany({ candidateId: formId }).exec();
    if (form.contributionId) await this.contribModel.findByIdAndDelete(form.contributionId).exec();
    await form.deleteOne();
    return { message: 'Deleted', votesRemoved: votes.deletedCount, paymentReversed: !!form.contributionId };
  }

  findForms(electionId: string) {
    return this.nominationModel.find({ electionId }).sort({ createdAt: -1 }).exec();
  }

  async setPayment(formId: string, status: string, reason?: string) {
    if (!['approved', 'rejected', 'pending'].includes(status)) throw new BadRequestException('Invalid status');
    const form = await this.nominationModel.findById(formId).exec();
    if (!form) throw new NotFoundException('Form not found');
    const election = await this.getElection(form.electionId);

    if (status === 'approved' && form.paymentStatus !== 'approved') {
      // Record the form fee as income in the Group Wallet so it shows in Finances
      const wallets = await this.wallets.findAll();
      const general = wallets.find((w: any) => w.type === 'general');
      const contrib = await this.contribModel.create({
        contributorName: form.memberName,
        amount: form.amount,
        date: new Date(),
        note: `Nomination form — ${form.positionTitle} (${form.reference})`,
        category: 'form-sales',
        walletId: general ? (general as any)._id.toString() : '',
        status: 'approved',
        email: form.email,
        phone: form.phone,
        memberId: form.memberId,
      });
      form.contributionId = (contrib as any)._id.toString();
      this.notify(form.phone,
        `✅ *Payment confirmed — ${election.title}*\n\nHi *${form.memberName}*, your *${form.positionTitle}* nomination form (${form.reference}) is now active.\n\n` +
        `Log in to the portal → Elections to submit your manifesto and photo. — IDAGHA Class of 2018`);
    }

    if (status !== 'approved' && form.paymentStatus === 'approved') {
      if (await this.voteModel.exists({ candidateId: formId })) {
        throw new BadRequestException('This candidate already has votes — payment cannot be reversed');
      }
      if (form.contributionId) await this.contribModel.findByIdAndDelete(form.contributionId).exec();
      form.contributionId = '';
      form.applicationStatus = 'none';
    }

    if (status === 'rejected') {
      form.rejectReason = reason || '';
      this.notify(form.phone,
        `⚠️ *${election.title}*\n\nHi *${form.memberName}*, we could not confirm your payment for the *${form.positionTitle}* form (${form.reference}).` +
        `${reason ? `\n\nReason: ${reason}` : ''}\n\nPlease contact the Secretary or upload a new proof on the portal.`);
    }

    form.paymentStatus = status;
    await form.save();
    return form;
  }

  async setScreening(formId: string, status: string, note?: string) {
    if (!['cleared', 'disqualified', 'submitted'].includes(status)) throw new BadRequestException('Invalid status');
    const form = await this.nominationModel.findById(formId).exec();
    if (!form) throw new NotFoundException('Form not found');
    if (form.paymentStatus !== 'approved') throw new BadRequestException('Payment must be approved first');
    if (status !== 'cleared' && await this.voteModel.exists({ candidateId: formId })) {
      throw new BadRequestException('This candidate already has votes');
    }
    form.applicationStatus = status;
    form.screeningNote = note || '';
    await form.save();

    if (status === 'cleared') {
      this.notify(form.phone,
        `🎉 *You have been cleared to contest!*\n\nCongratulations *${form.memberName}* — you are now an official candidate for *${form.positionTitle}*. ` +
        `Your profile and manifesto are live on the portal. Best of luck! — IDAGHA Class of 2018`);
    }
    return form;
  }

  async results(electionId: string) {
    const election = await this.getElection(electionId);
    const [tally, candidates, totalVoters] = await Promise.all([
      this.tally(electionId),
      this.nominationModel.find({ electionId, applicationStatus: 'cleared' }).select(CANDIDATE_PUBLIC).lean(),
      this.voteModel.distinct('memberId', { electionId }).then((v) => v.length),
    ]);
    return {
      election: { _id: election._id, title: election.title, status: election.status },
      totalVoters,
      positions: election.positions.map((p) => {
        const pid = p._id.toString();
        return {
          _id: pid,
          title: p.title,
          candidates: candidates
            .filter((c) => c.positionId === pid)
            .map((c) => ({ ...c, votes: tally[pid]?.[c._id.toString()] || 0 }))
            .sort((a, b) => b.votes - a.votes),
        };
      }),
    };
  }
}
