import {
  Controller, Get, Post, Put, Delete, Param, Body, Query,
  UseGuards, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
  constructor(private service: MembersService) {}

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
  @Post('register')
  register(@Body() body: RegisterMemberDto) {
    return this.service.register(body);
  }

  // Admin: add member directly (active)
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: CreateMemberDto) { return this.service.create(body); }

  // Public: upload photo for a member (sends base64 via multipart)
  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo', {
    limits: { fileSize: 3 * 1024 * 1024 }, // 3 MB max
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new BadRequestException('Only image files are allowed'), false);
      }
      cb(null, true);
    },
  }))
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('No image file provided');
    const base64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    return this.service.update(id, { photo: base64 } as any);
  }

  // Public: fetch own profile by ID
  @Get(':id/profile')
  getProfile(@Param('id') id: string) {
    return this.service.findById(id);
  }

  // Public: member self-update
  @Put(':id/self-update')
  selfUpdate(@Param('id') id: string, @Body() body: any) {
    return this.service.selfUpdate(id, body);
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
