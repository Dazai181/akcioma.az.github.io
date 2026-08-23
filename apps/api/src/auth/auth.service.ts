import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // ── Utilities ─────────────────────────────────────────────────────────

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendSmsOtp(mobile: string, otp: string): Promise<void> {
    // Development mode: log OTP to terminal instead of sending SMS.
    // Replace this block with your SMS provider in production.
    if (this.config.get('NODE_ENV') !== 'production') {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`  OTP for ${mobile}: ${otp}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      return;
    }

    // Twilio Verify (production):
    // const twilio = require('twilio');
    // const client = twilio(
    //   this.config.get('TWILIO_ACCOUNT_SID'),
    //   this.config.get('TWILIO_AUTH_TOKEN'),
    // );
    // await client.verify.v2
    //   .services(this.config.get('TWILIO_VERIFY_SERVICE_SID'))
    //   .verifications.create({ to: mobile, channel: 'sms' });
  }

  private issueTokens(
    userId: string,
    mobile: string,
    tier: string,
    isAdmin: boolean,
  ) {
    const payload = { sub: userId, mobile, tier, isAdmin };

    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
    });

    const refreshToken = this.jwt.sign(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return { accessToken, refreshToken };
  }

  // ── Registration flow ─────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { mobile: dto.mobile },
    });

    if (existing?.isVerified) {
      throw new ConflictException('Bu telefon numarası zaten kayıtlı.');
    }

    // Upsert allows re-sending OTP if previous attempt was not verified
    const user = await this.prisma.user.upsert({
      where: { mobile: dto.mobile },
      update: { firstName: dto.firstName, lastName: dto.lastName },
      create: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        mobile: dto.mobile,
      },
    });

    const otp = this.generateOtp();
    await this.redis.setOtp(dto.mobile, otp, 300); // 5 min TTL
    await this.sendSmsOtp(dto.mobile, otp);

    return { message: 'Doğrulama kodu gönderildi.', userId: user.id };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const stored = await this.redis.getOtp(dto.mobile);

    if (!stored || stored !== dto.otp) {
      throw new BadRequestException(
        'Geçersiz veya süresi dolmuş doğrulama kodu.',
      );
    }

    const user = await this.prisma.user.update({
      where: { mobile: dto.mobile },
      data: { isVerified: true },
    });

    await this.redis.deleteOtp(dto.mobile);

    const tokens = this.issueTokens(
      user.id,
      user.mobile,
      user.customerTier,
      user.isAdmin,
    );

    await this.redis.setRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        mobile: user.mobile,
        customerTier: user.customerTier,
      },
      needsPassword: !user.passwordHash,
    };
  }

  // ── Login flow ────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { mobile: dto.mobile },
    });

    if (!user || !user.isVerified) {
      throw new UnauthorizedException(
        'Telefon numarası veya şifre hatalı.',
      );
    }

    if (!user.passwordHash) {
      throw new BadRequestException(
        'Lütfen önce şifrenizi belirleyiniz. Yeni OTP talep ediniz.',
      );
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException(
        'Telefon numarası veya şifre hatalı.',
      );
    }

    const tokens = this.issueTokens(
      user.id,
      user.mobile,
      user.customerTier,
      user.isAdmin,
    );

    await this.redis.setRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        mobile: user.mobile,
        customerTier: user.customerTier,
        isAdmin: user.isAdmin,
      },
    };
  }

  async setPassword(userId: string, password: string) {
    const hash = await bcrypt.hash(password, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    });
    return { message: 'Şifre başarıyla oluşturuldu.' };
  }

  // ── Token management ──────────────────────────────────────────────────

  async refreshTokens(userId: string, incomingRefreshToken: string) {
    const stored = await this.redis.getRefreshToken(userId);

    if (!stored || stored !== incomingRefreshToken) {
      throw new UnauthorizedException('Geçersiz yenileme tokeni.');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const tokens = this.issueTokens(
      user.id,
      user.mobile,
      user.customerTier,
      user.isAdmin,
    );

    await this.redis.setRefreshToken(user.id, tokens.refreshToken);
    return tokens;
  }

  async logout(userId: string) {
    await this.redis.deleteRefreshToken(userId);
    return { message: 'Çıkış başarılı.' };
  }

  // ── Profile ───────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobile: true,
        customerTier: true,
        createdAt: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            status: true,
            total: true,
            createdAt: true,
            items: {
              select: {
                quantity: true,
                unitPrice: true,
                product: { select: { name: true } },
              },
            },
          },
        },
      },
    });
  }
}
