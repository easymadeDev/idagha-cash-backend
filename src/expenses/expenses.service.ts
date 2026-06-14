import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Expense, ExpenseDocument } from './expense.schema';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name) private model: Model<ExpenseDocument>,
  ) {}

  async findAll(category?: string, startDate?: string, endDate?: string) {
    const query: any = {};
    if (category) query.category = category;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    return this.model.find(query).sort({ date: -1 }).exec();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Expense not found');
    return doc;
  }

  async create(data: Partial<Expense>) {
    return this.model.create(data);
  }

  async update(id: string, data: Partial<Expense>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
    if (!doc) throw new NotFoundException('Expense not found');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.model.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Expense not found');
    return { message: 'Deleted successfully' };
  }

  async getTotal() {
    const result = await this.model.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return result[0]?.total || 0;
  }

  async getTotalByWallet(walletId: string) {
    const result = await this.model.aggregate([
      { $match: { walletId } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return result[0]?.total || 0;
  }
}
