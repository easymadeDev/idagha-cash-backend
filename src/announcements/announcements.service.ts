import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Announcement, AnnouncementDocument } from './announcement.schema';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectModel(Announcement.name) private model: Model<AnnouncementDocument>,
  ) {}

  async findAll() {
    return this.model.find({ isActive: true }).sort({ createdAt: -1 }).exec();
  }

  async findAllAdmin() {
    return this.model.find().sort({ createdAt: -1 }).exec();
  }

  async create(data: Partial<Announcement>) {
    return this.model.create(data);
  }

  async update(id: string, data: Partial<Announcement>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
    if (!doc) throw new NotFoundException('Announcement not found');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.model.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Announcement not found');
    return { message: 'Deleted successfully' };
  }
}
