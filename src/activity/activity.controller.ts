import { Controller, Get, Query } from '@nestjs/common';
import { ActivityService } from './activity.service';

@Controller('activity')
export class ActivityController {
  constructor(private service: ActivityService) {}

  @Get()
  getFeed(@Query('limit') limit?: string) {
    return this.service.getFeed(limit ? parseInt(limit, 10) : 20);
  }
}
