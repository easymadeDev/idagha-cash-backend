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

  // Debug: test EmailJS from Render
  @Get('mail-check')
  async mailCheck() {
    const serviceId = process.env.EMAILJS_SERVICE_ID;
    const templateId = process.env.EMAILJS_TEMPLATE_ID;
    const userId = process.env.EMAILJS_PUBLIC_KEY;
    const privateKey = process.env.EMAILJS_PRIVATE_KEY;
    if (!serviceId || !templateId || !userId || !privateKey) {
      return { status: 'FAILED', error: 'EmailJS env vars not set', vars: { serviceId: !!serviceId, templateId: !!templateId, userId: !!userId, privateKey: !!privateKey } };
    }
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: userId,
          accessToken: privateKey,
          template_params: { to_email: 'isaacsundayudoh@gmail.com', subject: 'IDAGHA EmailJS Test', html: '<p>EmailJS is working from Render!</p>' },
        }),
      });
      const text = await res.text();
      if (!res.ok) return { status: 'FAILED', error: text };
      return { status: 'OK — email sent to isaacsundayudoh@gmail.com!' };
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
