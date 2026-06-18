import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contribution, ContributionDocument } from '../contributions/contribution.schema';
import { Expense, ExpenseDocument } from '../expenses/expense.schema';
import { Member, MemberDocument } from '../members/member.schema';

export type ActivityItem = {
  id: string;
  type: 'contribution' | 'expense' | 'member_joined' | 'member_approved';
  title: string;
  subtitle: string;
  amount?: number;
  category?: string;
  date: Date;
};

@Injectable()
export class ActivityService {
  constructor(
    @InjectModel(Contribution.name) private contribModel: Model<ContributionDocument>,
    @InjectModel(Expense.name)      private expenseModel: Model<ExpenseDocument>,
    @InjectModel(Member.name)       private memberModel: Model<MemberDocument>,
  ) {}

  async getFeed(limit = 20): Promise<ActivityItem[]> {
    limit = Math.min(Math.max(1, limit), 100);
    const [contribs, expenses, members] = await Promise.all([
      this.contribModel.find().sort({ createdAt: -1 }).limit(limit).lean().exec(),
      this.expenseModel.find().sort({ createdAt: -1 }).limit(limit).lean().exec(),
      this.memberModel.find({ status: 'active' }).sort({ updatedAt: -1 }).limit(limit).lean().exec(),
    ]);

    const items: ActivityItem[] = [];

    for (const c of contribs) {
      const cat = (c.category || 'general').toLowerCase();
      const label = cat === 'reunion-fund' ? 'Reunion Fund' : cat === 'dues' ? 'Monthly Dues' : 'Contribution';
      items.push({
        id: String(c._id),
        type: 'contribution',
        title: `${c.contributorName} made a ${label} payment`,
        subtitle: c.note || label,
        amount: c.amount,
        category: c.category,
        date: (c as any).createdAt || c.date,
      });
    }

    for (const e of expenses) {
      items.push({
        id: String(e._id),
        type: 'expense',
        title: `Expense recorded: ${e.title}`,
        subtitle: e.description || e.category || 'General expense',
        amount: e.amount,
        category: e.category,
        date: (e as any).createdAt || e.date,
      });
    }

    for (const m of members) {
      items.push({
        id: String(m._id),
        type: 'member_joined',
        title: `${m.name} joined the alumni`,
        subtitle: [m.occupation, m.location].filter(Boolean).join(' · ') || 'New member',
        date: (m as any).updatedAt || (m as any).createdAt,
      });
    }

    // Sort all by date desc, return top N
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return items.slice(0, limit);
  }
}
