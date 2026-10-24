import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { AlumniEvent, AlumniEventDocument, Rsvp, RsvpDocument } from './event.schema';
import { Member, MemberDocument } from '../members/member.schema';

@Injectable()
export class EventsService {
  constructor(
    @InjectModel(AlumniEvent.name) private model: Model<AlumniEventDocument>,
    @InjectModel(Rsvp.name) private rsvpModel: Model<RsvpDocument>,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
  ) {}

  private async getEvent(id: string) {
    if (!isValidObjectId(id)) throw new NotFoundException('Event not found');
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Event not found');
    return doc;
  }

  // { [eventId]: { going, maybe, headcount } }
  private async counts(eventIds: string[]) {
    const rows = await this.rsvpModel.aggregate([
      { $match: { eventId: { $in: eventIds }, status: { $in: ['going', 'maybe'] } } },
      { $group: { _id: { e: '$eventId', s: '$status' }, n: { $sum: 1 }, guests: { $sum: '$guests' } } },
    ]);
    const out: Record<string, { going: number; maybe: number; headcount: number }> = {};
    for (const r of rows) {
      const c = (out[r._id.e] = out[r._id.e] || { going: 0, maybe: 0, headcount: 0 });
      if (r._id.s === 'going') { c.going = r.n; c.headcount = r.n + r.guests; } else c.maybe = r.n;
    }
    return out;
  }

  async findPublic() {
    const events = await this.model.find({ isPublished: true }).sort({ date: 1 }).lean();
    const counts = await this.counts(events.map((e) => e._id.toString()));
    return events.map((e) => ({ ...e, rsvp: counts[e._id.toString()] || { going: 0, maybe: 0, headcount: 0 } }));
  }

  async findOnePublic(id: string) {
    const event = await this.getEvent(id);
    if (!event.isPublished) throw new NotFoundException('Event not found');
    const counts = await this.counts([id]);
    const attendees = await this.rsvpModel.find({ eventId: id, status: 'going' })
      .select('memberName memberPhoto guests').sort({ createdAt: 1 }).lean();
    return { ...event.toObject(), rsvp: counts[id] || { going: 0, maybe: 0, headcount: 0 }, attendees };
  }

  async myRsvp(eventId: string, memberId: string) {
    return (await this.rsvpModel.findOne({ eventId, memberId }).lean()) || null;
  }

  async rsvp(eventId: string, memberId: string, body: { status: string; guests?: number; note?: string }) {
    if (!['going', 'maybe', 'not_going'].includes(body.status)) throw new BadRequestException('Invalid RSVP');
    const event = await this.getEvent(eventId);
    if (!event.isPublished || !event.rsvpOpen) throw new BadRequestException('RSVP is closed for this event');
    if (new Date(event.endDate || event.date).getTime() < Date.now()) {
      throw new BadRequestException('This event has already taken place');
    }

    const member = await this.memberModel.findById(memberId).select('name photo status').lean();
    if (!member || member.status !== 'active') throw new ForbiddenException('Only approved members can RSVP');

    const guests = Math.max(0, Math.min(10, Math.floor(body.guests || 0)));
    if (body.status === 'going' && event.capacity > 0) {
      const c = (await this.counts([eventId]))[eventId];
      const mine = await this.rsvpModel.findOne({ eventId, memberId, status: 'going' }).lean();
      const current = (c?.headcount || 0) - (mine ? 1 + mine.guests : 0);
      if (current + 1 + guests > event.capacity) throw new BadRequestException('Sorry — this event is fully booked');
    }

    return this.rsvpModel.findOneAndUpdate(
      { eventId, memberId },
      { $set: { status: body.status, guests: body.status === 'going' ? guests : 0, note: body.note || '',
                memberName: member.name, memberPhoto: member.photo || '' } },
      { upsert: true, returnDocument: 'after' },
    ).exec();
  }

  // ── Admin ──

  async findAllAdmin() {
    const events = await this.model.find().sort({ date: -1 }).lean();
    const counts = await this.counts(events.map((e) => e._id.toString()));
    return events.map((e) => ({ ...e, rsvp: counts[e._id.toString()] || { going: 0, maybe: 0, headcount: 0 } }));
  }

  findRsvps(eventId: string) {
    return this.rsvpModel.find({ eventId }).select('-memberPhoto').sort({ status: 1, memberName: 1 }).exec();
  }

  create(data: Partial<AlumniEvent>) {
    return this.model.create(data);
  }

  async update(id: string, data: Partial<AlumniEvent>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { returnDocument: 'after' }).exec();
    if (!doc) throw new NotFoundException('Event not found');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.model.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Event not found');
    await this.rsvpModel.deleteMany({ eventId: id }).exec();
    return { message: 'Deleted' };
  }
}
