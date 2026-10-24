import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { IsString, IsOptional, IsNotEmpty, IsIn } from 'class-validator';
import { GalleryService } from './gallery.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MemberAuthGuard } from '../auth/member-auth.guard';

class PhotoDto {
  @IsString() @IsNotEmpty() image: string;
  @IsOptional() @IsString() album?: string;
  @IsOptional() @IsString() caption?: string;
}

class UpdatePhotoDto {
  @IsOptional() @IsString() album?: string;
  @IsOptional() @IsString() caption?: string;
  @IsOptional() @IsIn(['approved', 'pending']) status?: string;
}

@Controller('gallery')
export class GalleryController {
  constructor(private service: GalleryService) {}

  @Get()
  findPublic(@Query('album') album?: string, @Query('page') page?: string) {
    return this.service.findPublic(album, parseInt(page || '1', 10) || 1);
  }

  @Get('albums')
  albums() { return this.service.albums(); }

  // Member: submit a memory — waits for admin approval
  @UseGuards(MemberAuthGuard)
  @Post('submit')
  submit(@Req() req: any, @Body() body: PhotoDto) { return this.service.submit(req.member, body); }

  @UseGuards(JwtAuthGuard)
  @Get('admin/all')
  findAllAdmin(@Query('status') status?: string) { return this.service.findAllAdmin(status); }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() body: PhotoDto) { return this.service.create(body); }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdatePhotoDto) { return this.service.update(id, body); }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
