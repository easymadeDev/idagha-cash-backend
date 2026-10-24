import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Executive, ExecutiveDocument } from './executive.schema';

@Injectable()
export class ExecutivesService {
  constructor(
    @InjectModel(Executive.name) private model: Model<ExecutiveDocument>,
  ) {}

  findAll() {
    return this.model.find().sort({ isCurrent: -1, tenure: -1, order: 1, createdAt: 1 }).exec();
  }

  // Past teams grouped by tenure, newest first
  async findPastGrouped() {
    const past = await this.model.find({ isCurrent: false }).sort({ tenure: -1, order: 1 }).lean();
    const groups: Record<string, any[]> = {};
    for (const e of past) {
      const key = e.tenure || 'Earlier';
      (groups[key] = groups[key] || []).push(e);
    }
    return Object.entries(groups).map(([tenure, members]) => ({ tenure, members }));
  }

  findCurrent() {
    return this.model.find({ isCurrent: true }).sort({ order: 1, createdAt: 1 }).exec();
  }

  create(data: Partial<Executive>) {
    return this.model.create(data);
  }

  async update(id: string, data: Partial<Executive>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { returnDocument: 'after' }).exec();
    if (!doc) throw new NotFoundException('Executive not found');
    return doc;
  }

  // Move the whole current team into the archive under a tenure label
  async archiveCurrent(tenure: string) {
    const res = await this.model.updateMany(
      { isCurrent: true },
      { $set: { isCurrent: false, tenure } },
    ).exec();
    return { archived: res.modifiedCount };
  }

  async remove(id: string) {
    const doc = await this.model.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Executive not found');
    return { message: 'Deleted' };
  }
}
