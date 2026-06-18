import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IsString, IsNotEmpty } from 'class-validator';

class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.username, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('verify')
  verify(@Request() req: any) {
    return { valid: true, user: req.user };
  }

  @Post('verify-pin')
  verifyPin(@Body() body: { pin: string }) {
    return this.authService.verifyPin(body.pin || '');
  }

  @Post('verify-member')
  verifyMember(@Body() body: { query: string }) {
    return this.authService.verifyMember(body.query || '');
  }
}
