import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsString, IsOptional, IsNotEmpty, IsNumber, IsArray, ValidateNested, IsIn, IsDateString, Min,
} from 'class-validator';
import { ElectionsService } from './elections.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MemberAuthGuard } from '../auth/member-auth.guard';
import { ELECTION_STATUSES } from './election.schema';

class PositionDto {
  @IsOptional() @IsString() _id?: string;
  @IsString() @IsNotEmpty() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() requirements?: string;
  @IsNumber() @Min(0) formPrice: number;
}

class ElectionDto {
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(ELECTION_STATUSES) status?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PositionDto) positions?: PositionDto[];
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() accountName?: string;
  @IsOptional() @IsString() accountNumber?: string;
  @IsOptional() @IsDateString() formSaleEnds?: string;
  @IsOptional() @IsDateString() votingStarts?: string;
  @IsOptional() @IsDateString() votingEnds?: string;
}

class CreateElectionDto extends ElectionDto {
  @IsString() @IsNotEmpty() declare title: string;
}

class BuyFormDto {
  @IsString() @IsNotEmpty() positionId: string;
  @IsString() @IsNotEmpty() payerName: string;
  @IsString() @IsNotEmpty() proofImage: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() note?: string;
}

class ApplicationDto {
  @IsString() @IsNotEmpty() manifesto: string;
  @IsOptional() @IsString() slogan?: string;
  @IsOptional() @IsString() photo?: string;
}

class VoteDto {
  @IsString() @IsNotEmpty() positionId: string;
  @IsString() @IsNotEmpty() candidateId: string;
}

class StatusDto {
  @IsString() @IsNotEmpty() status: string;
  @IsOptional() @IsString() reason?: string;
}

@Controller('elections')
export class ElectionsController {
  constructor(private service: ElectionsService) {}

  // ── Admin (declared before :id routes) ──
  @UseGuards(JwtAuthGuard)
  @Get('admin/all')
  findAllAdmin() { return this.service.findAllAdmin(); }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: CreateElectionDto) { return this.service.create(body as any); }

  @UseGuards(JwtAuthGuard)
  @Put('forms/:formId/payment')
  setPayment(@Param('formId') formId: string, @Body() body: StatusDto) {
    return this.service.setPayment(formId, body.status, body.reason);
  }

  @UseGuards(JwtAuthGuard)
  @Put('forms/:formId/screening')
  setScreening(@Param('formId') formId: string, @Body() body: StatusDto) {
    return this.service.setScreening(formId, body.status, body.reason);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/forms')
  findForms(@Param('id') id: string) { return this.service.findForms(id); }

  @UseGuards(JwtAuthGuard)
  @Get(':id/results')
  results(@Param('id') id: string) { return this.service.results(id); }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: ElectionDto) { return this.service.update(id, body as any); }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }

  // ── Member ──
  @UseGuards(MemberAuthGuard)
  @Put('forms/:formId/application')
  submitApplication(@Param('formId') formId: string, @Req() req: any, @Body() body: ApplicationDto) {
    return this.service.submitApplication(formId, req.member.id, body);
  }

  @UseGuards(MemberAuthGuard)
  @Get(':id/me')
  mine(@Param('id') id: string, @Req() req: any) { return this.service.findMine(id, req.member.id); }

  @UseGuards(MemberAuthGuard)
  @Post(':id/forms')
  buyForm(@Param('id') id: string, @Req() req: any, @Body() body: BuyFormDto) {
    return this.service.buyForm(id, req.member.id, body);
  }

  @UseGuards(MemberAuthGuard)
  @Post(':id/vote')
  vote(@Param('id') id: string, @Req() req: any, @Body() body: VoteDto) {
    return this.service.vote(id, req.member.id, body.positionId, body.candidateId);
  }

  // ── Public ──
  @Get()
  findPublic() { return this.service.findPublic(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOnePublic(id); }
}
