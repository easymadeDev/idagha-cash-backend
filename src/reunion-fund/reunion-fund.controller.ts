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

  // Debug: test Resend API from Render
  @Get('mail-check')
  async mailCheck() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { status: 'FAILED', error: 'RESEND_API_KEY not set' };
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: process.env.MAIL_USER || 'isaacsundayudoh@gmail.com',
          subject: 'IDAGHA Resend Test from Render',
          html: '<p>Resend is working from Render!</p>',
        }),
      });
      const data: any = await res.json();
      if (!res.ok) return { status: 'FAILED', error: data.message };
      return { status: 'OK — email sent!', id: data.id };
    } catch (err: any) {
      return { status: 'FAILED', error: err.message };
    }
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

  // Send WhatsApp reminders to members who haven't completed payment
  @UseGuards(JwtAuthGuard)
  @Post('notify-whatsapp')
  async sendWhatsappReminders(@Body() body: NotifyDto) {
    try {
      return await this.service.sendWhatsappReminders(body.memberNames);
    } catch (err: any) {
      throw new InternalServerErrorException(err.message || 'Failed to send WhatsApp reminders.');
    }
  }
}
