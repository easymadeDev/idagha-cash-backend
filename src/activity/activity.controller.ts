import { Controller, Get, Query } from '@nestjs/common';
import { ActivityService } from './activity.service';

@Controller('activity')
export class ActivityController {
  constructor(private service: ActivityService) {}

  @Get()
  getFeed(@Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 20;
    return this.service.getFeed(isNaN(n) ? 20 : n);
  }
}
