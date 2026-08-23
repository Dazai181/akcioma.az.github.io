import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    super(configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379');
  }
  async onModuleInit() {}
  async onModuleDestroy() { await this.quit(); }

  /** Store OTP with TTL (seconds). Returns true on success. */
  async setOtp(mobile: string, otp: string, ttlSeconds = 300): Promise<boolean> {
    const res = await this.set(`otp:${mobile}`, otp, 'EX', ttlSeconds);
    return res === 'OK';
  }

  async getOtp(mobile: string): Promise<string | null> {
    return this.get(`otp:${mobile}`);
  }

  async deleteOtp(mobile: string): Promise<void> {
    await this.del(`otp:${mobile}`);
  }

  /** Store refresh token hash with TTL */
  async setRefreshToken(userId: string, token: string, ttlSeconds = 604800): Promise<void> {
    await this.set(`refresh:${userId}`, token, 'EX', ttlSeconds);
  }

  async getRefreshToken(userId: string): Promise<string | null> {
    return this.get(`refresh:${userId}`);
  }

  async deleteRefreshToken(userId: string): Promise<void> {
    await this.del(`refresh:${userId}`);
  }
}
