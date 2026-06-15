import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Setting, SettingDocument } from './setting.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Setting.name) private settingModel: Model<SettingDocument>,
  ) {}

  async getSetting(key: string, defaultValue: any = null) {
    const setting = await this.settingModel.findOne({ key });
    if (!setting) return defaultValue;
    return setting.value;
  }

  async setSetting(key: string, value: any) {
    return this.settingModel.findOneAndUpdate(
      { key },
      { key, value },
      { upsert: true, new: true },
    );
  }
}
