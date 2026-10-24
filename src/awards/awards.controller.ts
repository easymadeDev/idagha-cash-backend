import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { IsString, IsOptional, IsNotEmpty, IsIn, IsNumber, IsBoolean } from 'class-validator';
import { AwardsService } from './awards.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MemberAuthGuard } from '../auth/member-auth.guard';

class CategoryDto {
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() emoji?: string;
  @IsOptional() @IsString() season?: string;
  @IsOptional() @IsIn(['draft', 'open', 'closed']) status?: string;
  @IsOptional() @IsNumber() order?: number;
}

class CreateCategoryDto extends CategoryDto {
  @IsString() @IsNotEmpty() declare title: string;
}

class NominateDto {
  @IsString() @IsNotEmpty() memberId: string;
  @IsOptional() @IsString() reason?: string;
}

class SupportDto {
  @IsString() @IsNotEmpty() nomineeId: string;
}

class HideDto {
  @IsBoolean() hidden: boolean;
}

@Controller('awards')
export class AwardsController {
  constructor(private service: AwardsService) {}

  @Get()
  board() { return this.service.board(); }

  @UseGuards(JwtAuthGuard)
  @Get('admin/all')
  boardAdmin() { return this.service.board(true, true); }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: CreateCategoryDto) { return this.service.createCategory(body); }

  @UseGuards(JwtAuthGuard)
  @Put('nominees/:id')
  hideNominee(@Param('id') id: string, @Body() body: HideDto) { return this.service.setNomineeHidden(id, body.hidden); }

  @UseGuards(JwtAuthGuard)
  @Delete('nominees/:id')
  removeNominee(@Param('id') id: string) { return this.service.removeNominee(id); }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: CategoryDto) { return this.service.updateCategory(id, body); }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.removeCategory(id); }

  @UseGuards(MemberAuthGuard)
  @Get('me')
  mine(@Req() req: any) { return this.service.mine(req.member.id); }

  @UseGuards(MemberAuthGuard)
  @Post(':id/nominate')
  nominate(@Param('id') id: string, @Req() req: any, @Body() body: NominateDto) {
    return this.service.nominate(id, req.member, body.memberId, body.reason);
  }

  @UseGuards(MemberAuthGuard)
  @Post(':id/support')
  support(@Param('id') id: string, @Req() req: any, @Body() body: SupportDto) {
    return this.service.support(id, req.member.id, body.nomineeId);
  }

  @UseGuards(MemberAuthGuard)
  @Delete(':id/support')
  withdraw(@Param('id') id: string, @Req() req: any) { return this.service.withdrawSupport(id, req.member.id); }
}
