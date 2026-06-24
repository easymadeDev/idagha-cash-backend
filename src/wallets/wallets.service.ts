import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Wallet, WalletDocument } from './wallet.schema';

@Injectable()
export class WalletsService implements OnModuleInit {
  constructor(
    @InjectModel(Wallet.name) private model: Model<WalletDocument>,
  ) {}

  async onModuleInit() {
    await this.seedDefaults();
  }

  private async seedDefaults() {
    const count = await this.model.countDocuments();
    if (count === 0) {
      await this.model.insertMany([
        {
          name: 'Group Wallet',
          description: 'General dues, monthly contributions and miscellaneous income',
          type: 'general',
          color: '#60a5fa',
          isActive: true,
        },
        {
          name: 'Reunion Fund Wallet',
          description: 'Dedicated wallet for the 2018 Reunion Fund — ₦10,000 per member',
          type: 'reunion',
          color: '#fbbf24',
          isActive: true,
        },
        {
          name: 'Reunion Support Wallet',
          description: 'Tracks all reunion support. Fulfilled support is automatically moved to the Reunion Fund Wallet.',
          type: 'pledge',
          color: '#a855f7',
          isActive: true,
        },
      ]);
    } else {
      // Ensure promise wallet exists for existing deployments
      const pledgeWallet = await this.model.findOne({ type: 'pledge' }).exec();
      if (!pledgeWallet) {
        await this.model.create({
          name: 'Reunion Support Wallet',
          description: 'Tracks all reunion support. Fulfilled support is automatically moved to the Reunion Fund Wallet.',
          type: 'pledge',
          color: '#a855f7',
          isActive: true,
        });
      } else if (pledgeWallet.name === 'Reunion Pledge Wallet' || pledgeWallet.name === 'Reunion Promise Wallet') {
        await this.model.findByIdAndUpdate((pledgeWallet as any)._id, {
          name: 'Reunion Support Wallet',
          description: 'Tracks all reunion support. Fulfilled support is automatically moved to the Reunion Fund Wallet.',
        });
      }
    }
  }

  async findAll() {
    return this.model.find({ isActive: true }).sort({ createdAt: 1 }).exec();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Wallet not found');
    return doc;
  }

  async create(data: Partial<Wallet>) {
    return this.model.create(data);
  }

  async update(id: string, data: Partial<Wallet>) {
    const doc = await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
    if (!doc) throw new NotFoundException('Wallet not found');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.model.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Wallet not found');
    return { message: 'Deleted successfully' };
  }
}
