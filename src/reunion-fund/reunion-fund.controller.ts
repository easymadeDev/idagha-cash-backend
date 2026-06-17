import { Controller, Get, Put, Post, Body, UseGuards, InternalServerErrorException } from '@nestjs/common';
import { ReunionFundService } from './reunion-fund.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsNumber, IsOptional, IsString, IsDateString, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateReunionFundDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @Type(() => Number) @IsNumber() targetAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() raisedAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() memberTarget?: number;
  @IsOptional() @Type(() => Number) @IsNumber() totalMembers?: number;
  @IsOptional() @IsDateString() targetDate?: string;
  @IsOptional() @IsString() description?: string;
}

class NotifyDto {
  @IsOptional() @IsArray() @IsString({ each: true }) memberNames?: string[];
}

@Controller('reunion-fund')
export class ReunionFundController {
  constructor(private service: ReunionFundService) {}

  @Get()
  get() { return this.service.get(); }

  @Get('members')
  getMemberBreakdown() { return this.service.getMemberBreakdown(); }

  @UseGuards(JwtAuthGuard)
  @Put()
  update(@Body() body: UpdateReunionFundDto) {
    const data: any = { ...body };
    if (body.targetDate) data.targetDate = new Date(body.targetDate);
    return this.service.update(data);
  }

  // Debug: check mail env vars on Render (remove after fixing)
  @Get('mail-check')
  mailCheck() {
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;
    return {
      MAIL_USER: user ? `set (${user})` : 'NOT SET',
      MAIL_PASS: pass ? `set (length=${pass.length})` : 'NOT SET',
      MAIL_FROM: process.env.MAIL_FROM || 'NOT SET',
    };
  }

  // Send email reminders to members who haven't completed payment
  @UseGuards(JwtAuthGuard)
  @Post('notify')
  async sendReminders(@Body() body: NotifyDto) {
    try {
      return await this.service.sendReminders(body.memberNames);
    } catch (err: any) {
      throw new InternalServerErrorException(err.message || 'Failed to send reminders.');
    }
  }
}
