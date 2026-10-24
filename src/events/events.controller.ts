import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { IsString, IsOptional, IsNotEmpty, IsNumber, IsBoolean, IsIn, IsDateString, Min } from 'class-validator';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MemberAuthGuard } from '../auth/member-auth.guard';

const EVENT_TYPES = ['reunion', 'meeting', 'social', 'outreach', 'other'];

class EventDto {
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsIn(EVENT_TYPES) type?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() venue?: string;
  @IsOptional() @IsString() coverImage?: string;
  @IsOptional() @IsNumber() @Min(0) fee?: number;
  @IsOptional() @IsString() dressCode?: string;
  @IsOptional() @IsNumber() @Min(0) capacity?: number;
  @IsOptional() @IsBoolean() rsvpOpen?: boolean;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

class CreateEventDto extends EventDto {
  @IsString() @IsNotEmpty() declare title: string;
  @IsDateString() declare date: string;
}

class RsvpDto {
  @IsIn(['going', 'maybe', 'not_going']) status: string;
  @IsOptional() @IsNumber() @Min(0) guests?: number;
  @IsOptional() @IsString() note?: string;
}

@Controller('events')
export class EventsController {
  constructor(private service: EventsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('admin/all')
  findAllAdmin() { return this.service.findAllAdmin(); }

  @UseGuards(JwtAuthGuard)
  @Get(':id/rsvps')
  findRsvps(@Param('id') id: string) { return this.service.findRsvps(id); }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: CreateEventDto) { return this.service.create(body as any); }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: EventDto) { return this.service.update(id, body as any); }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  @UseGuards(MemberAuthGuard)
  @Get(':id/my-rsvp')
  myRsvp(@Param('id') id: string, @Req() req: any) { return this.service.myRsvp(id, req.member.id); }

  @UseGuards(MemberAuthGuard)
  @Post(':id/rsvp')
  rsvp(@Param('id') id: string, @Req() req: any, @Body() body: RsvpDto) {
    return this.service.rsvp(id, req.member.id, body);
  }

  @Get()
  findPublic() { return this.service.findPublic(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOnePublic(id); }
}
