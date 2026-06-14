import { Controller, Get } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private service: StatsService) {}

  @Get('summary')
  getSummary() {
    return this.service.getSummary();
  }

  @Get('monthly')
  getMonthlyReport() {
    return this.service.getMonthlyReport();
  }

  @Get('wallets')
  getWalletStats() {
    return this.service.getWalletStats();
  }
}
