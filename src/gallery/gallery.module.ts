import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';
import { Photo, PhotoSchema } from './photo.schema';
import { AuthModule } from '../auth/auth.module';
import { MemberAuthGuard } from '../auth/member-auth.guard';

@Module({
  imports: [MongooseModule.forFeature([{ name: Photo.name, schema: PhotoSchema }]), AuthModule],
  controllers: [GalleryController],
  providers: [GalleryService, MemberAuthGuard],
})
export class GalleryModule {}
