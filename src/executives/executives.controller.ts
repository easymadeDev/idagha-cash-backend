import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { IsString, IsOptional, IsBoolean, IsNumber, IsNotEmpty } from 'class-validator';
import { ExecutivesService } from './executives.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class ExecutiveDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() position: string;
  @IsOptional() @IsString() memberId?: string;
  @IsOptional() @IsString() photo?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() tenure?: string;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
  @IsOptional() @IsNumber() order?: number;
}

class UpdateExecutiveDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() memberId?: string;
  @IsOptional() @IsString() photo?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() tenure?: string;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
  @IsOptional() @IsNumber() order?: number;
}

class ArchiveDto {
  @IsString() @IsNotEmpty() tenure: string;
}

@Controller('executives')
export class ExecutivesController {
  constructor(private service: ExecutivesService) {}

  // Public: current executive team
  @Get()
  findCurrent() { return this.service.findCurrent(); }

  // Public: past teams grouped by tenure
  @Get('past')
  findPast() { return this.service.findPastGrouped(); }

  @UseGuards(JwtAuthGuard)
  @Get('admin/all')
  findAll() { return this.service.findAll(); }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: ExecutiveDto) { return this.service.create(body); }

  // Admin: hand over — archive the current team under a tenure label
  @UseGuards(JwtAuthGuard)
  @Post('archive-current')
  archive(@Body() body: ArchiveDto) { return this.service.archiveCurrent(body.tenure); }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateExecutiveDto) { return this.service.update(id, body); }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
