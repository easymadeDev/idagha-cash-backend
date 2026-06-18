import { Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Member, MemberDocument } from '../members/member.schema';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    @InjectModel(Member.name) private memberModel: Model<MemberDocument>,
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

  async verifyPin(pin: string) {
    const groupPin = this.config.get<string>('GROUP_PIN');
    if (!groupPin) throw new InternalServerErrorException('GROUP_PIN not configured');
    if (pin.trim().toUpperCase() !== groupPin.trim().toUpperCase()) {
      throw new UnauthorizedException('Incorrect PIN');
    }
    const token = this.jwtService.sign({ type: 'gate' }, { expiresIn: '24h' });
    return { gate_token: token };
  }

  async verifyMember(query: string) {
    const q = query.trim();
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const phone = esc.replace(/\s+/g, '');
    const member = await this.memberModel.findOne({
      status: 'active',
      $or: [
        { name:     { $regex: esc,   $options: 'i' } },
        { phone:    { $regex: phone, $options: 'i' } },
        { whatsapp: { $regex: phone, $options: 'i' } },
        { email:    { $regex: `^${esc}$`, $options: 'i' } },
      ],
    }).select('_id name nickname photo position').lean();

    if (!member) return { found: false };

    const token = this.jwtService.sign(
      { type: 'member', id: member._id.toString(), name: member.name },
      { expiresIn: '24h' },
    );
    return { found: true, member_token: token, member };
  }
}
