import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async login(username: string, password: string) {
    const adminUsername = this.config.get<string>('ADMIN_USERNAME') || 'secretary';
    const adminPassword = this.config.get<string>('ADMIN_PASSWORD') || 'Idagha@2026';

    if (username !== adminUsername || password !== adminPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { username, role: 'admin' };
    return {
      access_token: this.jwtService.sign(payload),
      username,
      role: 'admin',
    };
  }
}
