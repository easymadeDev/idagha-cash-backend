import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// Validates the x-member-token header issued by /auth/verify-member and exposes
// the caller as req.member = { id, name }
@Injectable()
export class MemberAuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const token = req.headers['x-member-token'];
    if (!token) throw new UnauthorizedException('Please verify your membership first');
    let payload: any;
    try {
      payload = this.jwt.verify(token);
    } catch {
      throw new UnauthorizedException('Your session has expired — please verify again');
    }
    if (payload.type !== 'member' || !payload.id) throw new UnauthorizedException('Invalid member token');
    req.member = { id: payload.id, name: payload.name };
    return true;
  }
}
