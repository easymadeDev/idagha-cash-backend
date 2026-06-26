import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
  UnauthorizedException, Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BirthdayScheduler } from './birthday.scheduler';
import { IsString, IsOptional, IsEmail } from 'class-validator';

class RegisterMemberDto {
  @IsString() name: string;
  @IsOptional() @IsString() nickname?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() whatsapp?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() occupation?: string;
  @IsOptional() @IsString() birthday?: string;
  @IsOptional() @IsString() photo?: string;
}

class CreateMemberDto extends RegisterMemberDto {
  @IsOptional() @IsString() position?: string;
}

@Controller('members')
export class MembersController {
  constructor(
    private service: MembersService,
    private jwt: JwtService,
    private birthdayScheduler: BirthdayScheduler,
  ) {}

  private verifyMemberToken(token: string | undefined, id: string): void {
    if (!token) throw new UnauthorizedException('Member token required');
    let payload: any;
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired member token');
    }
    if (payload.type !== 'member' || payload.id !== id) {
      throw new UnauthorizedException('Token does not match this member');
    }
  }

  // Public: active members only
  @Get()
  findAll() { return this.service.findAll(); }

  // Admin: all members including pending
  @UseGuards(JwtAuthGuard)
  @Get('admin/all')
  findAllAdmin() { return this.service.findAllAdmin(); }

  // Public: verify membership by name / phone / email
  @Get('verify')
  verify(@Query('q') q: string) {
    if (!q || q.trim().length < 2) throw new BadRequestException('Query too short');
    return this.service.verify(q);
  }

  // Public: self-registration (pending approval)
  // Returns member + a short-lived member_token so they can update their profile immediately
  @Post('register')
  async register(@Body() body: RegisterMemberDto) {
    const member = await this.service.register(body);
    const member_token = this.jwt.sign(
      { type: 'member', id: (member as any)._id.toString(), name: (member as any).name },
      { expiresIn: '7d' },
    );
    return { ...((member as any).toObject ? (member as any).toObject() : member), member_token };
  }

  // Admin: add member directly (active)
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: CreateMemberDto) { return this.service.create(body); }

  // Accepts either an admin JWT (Authorization: Bearer) or the member's own token (x-member-token)
  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo', {
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new BadRequestException('Only image files are allowed'), false);
      }
      cb(null, true);
    },
  }))
  async uploadPhoto(
    @Param('id') id: string,
    @Headers('authorization') authHeader: string,
    @Headers('x-member-token') memberToken: string,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('No image file provided');

    // Verify caller is either the admin or the member who owns this profile
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    let authorized = false;
    if (bearerToken) {
      try {
        const p = this.jwt.verify(bearerToken) as any;
        if (p.role === 'admin') authorized = true;
      } catch {}
    }
    if (!authorized && memberToken) {
      try {
        const p = this.jwt.verify(memberToken) as any;
        if (p.type === 'member' && p.id === id) authorized = true;
      } catch {}
    }
    if (!authorized) throw new UnauthorizedException('Not authorised to upload photo for this member');

    const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    return this.service.update(id, { photo: base64 } as any);
  }

  // Requires member_token header — validates caller owns this profile
  @Get(':id/profile')
  getProfile(
    @Param('id') id: string,
    @Headers('x-member-token') token: string,
  ) {
    this.verifyMemberToken(token, id);
    return this.service.findById(id);
  }

  @Put(':id/self-update')
  selfUpdate(
    @Param('id') id: string,
    @Headers('x-member-token') token: string,
    @Body() body: any,
  ) {
    this.verifyMemberToken(token, id);
    return this.service.selfUpdate(id, body);
  }

  // Admin: send a notification/reminder email to a specific member
  @UseGuards(JwtAuthGuard)
  @Post(':id/notify')
  notify(
    @Param('id') id: string,
    @Body() body: { subject: string; message: string; channels?: string[] },
  ) {
    return this.service.notifyMember(id, body.subject, body.message, body.channels);
  }

  // Admin: test welcome message to one member by name
  @UseGuards(JwtAuthGuard)
  @Post('welcome/test')
  testWelcome(@Body() body: { name: string }) {
    return this.service.sendWelcomeToOne(body.name);
  }

  // Admin: send welcome message to ALL active members
  @UseGuards(JwtAuthGuard)
  @Post('welcome/all')
  welcomeAll() {
    return this.service.sendWelcomeToAll();
  }

  // Admin: send welcome message to selected members by ID
  @UseGuards(JwtAuthGuard)
  @Post('welcome/selected')
  welcomeSelected(@Body() body: { memberIds: string[] }) {
    return this.service.sendWelcomeToSelected(body.memberIds);
  }

  // Admin: test birthday wishes manually
  @UseGuards(JwtAuthGuard)
  @Post('birthday/test')
  testBirthday() {
    return this.birthdayScheduler.checkAndSendBirthdays();
  }

  // Admin: approve a pending registration
  @UseGuards(JwtAuthGuard)
  @Put(':id/approve')
  approve(@Param('id') id: string) { return this.service.approve(id); }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.service.update(id, body); }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
