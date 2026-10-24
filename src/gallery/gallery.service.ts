import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Photo, PhotoDocument } from './photo.schema';

const PAGE_SIZE = 24;

@Injectable()
export class GalleryService {
  constructor(@InjectModel(Photo.name) private model: Model<PhotoDocument>) {}

  private checkImage(image: string) {
    if (!image?.startsWith('data:image/')) throw new BadRequestException('Please attach an image');
  }

  async findPublic(album?: string, page = 1) {
    const filter: any = { status: 'approved' };
    if (album) filter.album = album;
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ createdAt: -1 })
        .skip((Math.max(1, page) - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
      this.model.countDocuments(filter),
    ]);
    return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  }

  // Album list with photo count and the newest photo as cover
  albums() {
    return this.model.aggregate([
      { $match: { status: 'approved' } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$album', count: { $sum: 1 }, cover: { $first: '$image' }, updatedAt: { $first: '$createdAt' } } },
      { $sort: { updatedAt: -1 } },
      { $project: { _id: 0, name: '$_id', count: 1, cover: 1 } },
    ]);
  }

  submit(member: { id: string; name: string }, body: { image: string; album?: string; caption?: string }) {
    this.checkImage(body.image);
    return this.model.create({
      image: body.image,
      album: body.album?.trim() || 'Memories',
      caption: body.caption || '',
      uploadedBy: member.name,
      memberId: member.id,
      status: 'pending',
    });
  }

  findAllAdmin(status?: string) {
    return this.model.find(status ? { status } : {}).sort({ status: -1, createdAt: -1 }).exec();
  }

  create(body: { image: string; album?: string; caption?: string }) {
    this.checkImage(body.image);
    return this.model.create({
      image: body.image,
      album: body.album?.trim() || 'Memories',
      caption: body.caption || '',
      uploadedBy: 'Secretary',
      status: 'approved',
    });
  }

  async update(id: string, data: Partial<Photo>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { returnDocument: 'after' }).exec();
    if (!doc) throw new NotFoundException('Photo not found');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.model.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Photo not found');
    return { message: 'Deleted' };
  }
}
