import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import {
  AwardCategory, AwardCategoryDocument, AwardNominee, AwardNomineeDocument, AwardSupport, AwardSupportDocument,
} from './award.schema';
import { Member, MemberDocument } from '../members/member.schema';

@Injectable()
export class AwardsService {
  constructor(
    @InjectModel(AwardCategory.name) private categoryModel: Model<AwardCategoryDocument>,
    @InjectModel(AwardNominee.name) private nomineeModel: Model<AwardNomineeDocument>,
    @InjectModel(AwardSupport.name) private supportModel: Model<AwardSupportDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
  ) {}

  private async getCategory(id: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Award category not found');
    const doc = await this.categoryModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Award category not found');
    return doc;
  }

  private async getActiveMember(id: string) {
    if (!isValidObjectId(id)) throw new ForbiddenException('Only approved members can take part');
    const m = await this.memberModel.findById(id).select('name photo status isActive').lean();
    if (!m || m.status !== 'active' || !m.isActive) throw new ForbiddenException('Only approved members can take part');
    return m;
  }

  // Categories with nominees ranked by support count
  async board(includeDraft = false, includeHidden = false) {
    const categories = await this.categoryModel
      .find(includeDraft ? {} : { status: { $ne: 'draft' } })
      .sort({ order: 1, createdAt: 1 }).lean();
    const ids = categories.map((c) => c._id.toString());
    const [nominees, supports] = await Promise.all([
      this.nomineeModel.find({ categoryId: { $in: ids }, ...(includeHidden ? {} : { hidden: false }) }).lean(),
      this.supportModel.aggregate([
        { $match: { categoryId: { $in: ids } } },
        { $group: { _id: '$nomineeId', n: { $sum: 1 } } },
      ]),
    ]);
    const supportBy = Object.fromEntries(supports.map((s) => [s._id, s.n]));
    return categories.map((c) => {
      const cid = c._id.toString();
      const list = nominees
        .filter((n) => n.categoryId === cid)
        .map((n) => ({ ...n, supports: supportBy[n._id.toString()] || 0 }))
        .sort((a, b) => b.supports - a.supports || a.memberName.localeCompare(b.memberName));
      const totalSupports = list.reduce((s, n) => s + n.supports, 0);
      return { ...c, nominees: list, totalSupports, winner: c.status === 'closed' && list[0]?.supports ? list[0] : null };
    });
  }

  async mine(memberId: string) {
    const supports = await this.supportModel.find({ memberId }).select('categoryId nomineeId').lean();
    return { supports };
  }

  async nominate(categoryId: string, by: { id: string; name: string }, nomineeMemberId: string, reason?: string) {
    const category = await this.getCategory(categoryId);
    if (category.status !== 'open') throw new BadRequestException('Nominations are closed for this award');
    await this.getActiveMember(by.id);
    const nominee = await this.getActiveMember(nomineeMemberId);

    const existing = await this.nomineeModel.findOne({ categoryId, memberId: nomineeMemberId }).lean();
    if (existing) {
      if (existing.hidden) throw new BadRequestException('This nomination is not available');
      throw new ConflictException(`${nominee.name} is already nominated — support them instead!`);
    }
    const doc = await this.nomineeModel.create({
      categoryId,
      memberId: nomineeMemberId,
      memberName: nominee.name,
      memberPhoto: nominee.photo || '',
      nominatedById: by.id,
      nominatedByName: by.name,
      reason: (reason || '').slice(0, 280),
    });
    // Nominating someone counts as supporting them
    await this.supportModel.updateOne(
      { categoryId, memberId: by.id },
      { $setOnInsert: { nomineeId: doc._id.toString() } },
      { upsert: true },
    );
    return doc;
  }

  async support(categoryId: string, memberId: string, nomineeId: string) {
    const category = await this.getCategory(categoryId);
    if (category.status !== 'open') throw new BadRequestException('Support is closed for this award');
    await this.getActiveMember(memberId);
    if (!isValidObjectId(nomineeId)) throw new BadRequestException('Invalid nominee');
    const nominee = await this.nomineeModel.findById(nomineeId).lean();
    if (!nominee || nominee.categoryId !== categoryId || nominee.hidden) throw new BadRequestException('Invalid nominee');

    await this.supportModel.updateOne(
      { categoryId, memberId },
      { $set: { nomineeId } },
      { upsert: true },
    );
    return { ok: true, categoryId, nomineeId };
  }

  async withdrawSupport(categoryId: string, memberId: string) {
    const category = await this.getCategory(categoryId);
    if (category.status !== 'open') throw new BadRequestException('This award is closed');
    await this.supportModel.deleteOne({ categoryId, memberId });
    return { ok: true };
  }

  // ── Admin ──

  createCategory(data: Partial<AwardCategory>) {
    return this.categoryModel.create(data);
  }

  async updateCategory(id: string, data: Partial<AwardCategory>) {
    const doc = await this.categoryModel.findByIdAndUpdate(id, data, { returnDocument: 'after' }).exec();
    if (!doc) throw new NotFoundException('Award category not found');
    return doc;
  }

  async removeCategory(id: string) {
    const doc = await this.categoryModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Award category not found');
    await Promise.all([
      this.nomineeModel.deleteMany({ categoryId: id }).exec(),
      this.supportModel.deleteMany({ categoryId: id }).exec(),
    ]);
    return { message: 'Deleted' };
  }

  async setNomineeHidden(id: string, hidden: boolean) {
    const doc = await this.nomineeModel.findByIdAndUpdate(id, { hidden }, { returnDocument: 'after' }).exec();
    if (!doc) throw new NotFoundException('Nominee not found');
    return doc;
  }

  async removeNominee(id: string) {
    const doc = await this.nomineeModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Nominee not found');
    await this.supportModel.deleteMany({ nomineeId: id }).exec();
    return { message: 'Deleted' };
  }
}
