import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { IsString, IsNotEmpty } from 'class-validator';

class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Admin login: max 5 attempts per minute
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.authService.login(body.username, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('verify')
  verify(@Request() req: any) {
    return { valid: true, user: req.user };
  }

  // PIN verify: max 10 attempts per minute
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-pin')
  verifyPin(@Body() body: { pin: string }) {
    return this.authService.verifyPin(body.pin || '');
  }

  // Member verify: max 15 attempts per minute
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Post('verify-member')
  verifyMember(@Body() body: { query: string }) {
    return this.authService.verifyMember(body.query || '');
  }

  @Get('ping')
  ping() { return { ok: true }; }

  @Get('health')
  health() { return { status: 'ok', timestamp: new Date().toISOString(), service: 'idagha-backend' }; }
}
