import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contribution, ContributionDocument } from './contribution.schema';

@Injectable()
export class ContributionsService {
  constructor(
    @InjectModel(Contribution.name) private model: Model<ContributionDocument>,
  ) {}

  async findAll(search?: string, startDate?: string, endDate?: string, status?: string) {
    const query: any = {};
    if (search) {
      query.contributorName = { $regex: search, $options: 'i' };
    }
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (status) {
      query.status = status;
    }
    return this.model.find(query).sort({ date: -1 }).exec();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Contribution not found');
    return doc;
  }

  async create(data: Partial<Contribution>) {
    return this.model.create(data);
  }

  async update(id: string, data: Partial<Contribution>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { returnDocument: 'after' }).exec();
    if (!doc) throw new NotFoundException('Contribution not found');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.model.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Contribution not found');
    return { message: 'Deleted successfully' };
  }

  async getTotal() {
    const result = await this.model.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return result[0]?.total || 0;
  }

  async getTotalByWallet(walletId: string) {
    const result = await this.model.aggregate([
      { $match: { walletId, status: 'approved' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return result[0]?.total || 0;
  }
}
