import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'idagha_super_secret_key_2026',
    });
  }

  async validate(payload: any) {
    // Member and gate tokens share the same secret — only admin tokens may pass this guard
    if (payload.role !== 'admin') throw new UnauthorizedException('Admin access required');
    return { username: payload.username, role: payload.role };
  }
}
