import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('settings')
export class SettingsController {
  constructor(private service: SettingsService) {}

  @Get('bank-accounts')
  async getBankAccounts() {
    const defaultAccounts = [
      {
        bank: 'First Bank of Nigeria',
        accountName: 'IDAGHA CLASS 2018 ALUMNI',
        accountNumber: '3123456789',
        icon: '🏦',
        color: 'rgba(34,197,94,0.12)',
        border: 'rgba(34,197,94,0.3)',
      },
      {
        bank: 'Access Bank',
        accountName: 'IDAGHA CLASS 2018 ALUMNI',
        accountNumber: '0987654321',
        icon: '🏛️',
        color: 'rgba(96,165,250,0.12)',
        border: 'rgba(96,165,250,0.3)',
      },
    ];
    return this.service.getSetting('bankAccounts', defaultAccounts);
  }

  @UseGuards(JwtAuthGuard)
  @Put('bank-accounts')
  async updateBankAccounts(@Body() body: any[]) {
    await this.service.setSetting('bankAccounts', body);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('cron-schedule')
  async getCronSchedule() {
    return this.service.getCronSchedule();
  }

  @UseGuards(JwtAuthGuard)
  @Put('cron-schedule')
  async updateCronSchedule(@Body() body: any) {
    return this.service.updateCronSchedule(body);
  }
}
