import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Setting, SettingDocument } from './setting.schema';
import { CronSchedule, CronScheduleDocument } from './cron-schedule.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Setting.name) private settingModel: Model<SettingDocument>,
    @InjectModel(CronSchedule.name) private cronModel: Model<CronScheduleDocument>,
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
      { upsert: true, returnDocument: 'after' },
    );
  }

  async getCronSchedule() {
    let schedule = await this.cronModel.findOne().exec();
    if (!schedule) {
      schedule = await this.cronModel.create({
        birthdayTime: '0 8 * * *',
        reunionReminderTime: '0 8 * * 1',
        birthdayEnabled: true,
        reunionReminderEnabled: true,
      });
    }
    return schedule;
  }

  async updateCronSchedule(data: Partial<CronSchedule>) {
    const schedule = await this.getCronSchedule();
    return this.cronModel.findByIdAndUpdate(schedule._id, data, { new: true }).exec();
  }
}
