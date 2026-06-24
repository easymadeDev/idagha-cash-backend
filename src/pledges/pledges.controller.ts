import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { IsString, IsNumber, IsOptional as IsOpt, IsDateString, IsEmail, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PledgesService } from './pledges.service';

class CreatePledgeDto {
  @IsString() memberName: string;
  @IsOpt() @IsString() memberEmail?: string;
  @IsOpt() @IsString() memberPhone?: string;
  @IsOpt() @IsString() memberId?: string;
  @Type(() => Number) @IsNumber() @Min(1) amount: number;
  @IsOpt() @IsString() note?: string;
  @IsOpt() @IsString() dueDate?: string;
}

class UpdatePledgeDto {
  @IsOpt() @IsString() memberName?: string;
  @IsOpt() @IsString() memberEmail?: string;
  @IsOpt() @IsString() memberPhone?: string;
  @IsOpt() @Type(() => Number) @IsNumber() @Min(1) amount?: number;
  @IsOpt() @IsString() note?: string;
  @IsOpt() @IsString() dueDate?: string;
}

class SendReminderDto {
  @IsOpt() pledgeIds?: string[];
}

@Controller('pledges')
export class PledgesController {
  constructor(private readonly service: PledgesService) {}

  // ── public ────────────────────────────────────────────────────────────────

  @Get('stats')
  getStats() {
    return this.service.getStats();
  }

  @Get()
  findAll(@Query('status') status?: string) {
    return this.service.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  // Member self-pledge (public)
  @Post()
  create(@Body() dto: CreatePledgeDto) {
    return this.service.create({ ...dto, addedBy: 'self' });
  }

  // ── admin ─────────────────────────────────────────────────────────────────

  // Admin adds pledge for a specific member
  @UseGuards(JwtAuthGuard)
  @Post('admin')
  adminCreate(@Body() dto: CreatePledgeDto) {
    return this.service.create({ ...dto, addedBy: 'admin' });
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePledgeDto) {
    return this.service.update(id, dto as any);
  }

  // Mark pledge as fulfilled → moves to reunion wallet
  @UseGuards(JwtAuthGuard)
  @Put(':id/fulfill')
  fulfill(@Param('id') id: string) {
    return this.service.fulfill(id);
  }

  // Manual reminder trigger
  @UseGuards(JwtAuthGuard)
  @Post('reminders/send')
  sendReminders(@Body() dto: SendReminderDto) {
    return this.service.sendReminders(dto.pledgeIds);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
