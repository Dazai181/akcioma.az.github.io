import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { GameType } from '@prisma/client';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GamificationService } from './gamification.service';

const VALID_TYPES: GameType[] = ['DAILY_CHECKIN', 'SPIN_WHEEL', 'SCRATCH_CARD'];

function parseType(raw: string): GameType {
  const t = raw.toUpperCase().replace(/-/g, '_') as GameType;
  if (!VALID_TYPES.includes(t)) {
    throw new BadRequestException('Geçersiz oyun türü.');
  }
  return t;
}

@Controller('games')
export class GamificationController {
  constructor(private games: GamificationService) {}

  /** Public read — anyone can see what games exist + which rewards are listed. */
  @Get(':type')
  @UseGuards(OptionalJwtGuard)
  get(@Param('type') type: string, @Req() req: Request) {
    return this.games.getPublicView(parseType(type), req.user?.id ?? null);
  }

  /** Logged-in users only. Plays the game; server picks the reward. */
  @Post(':type/play')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  play(@Param('type') type: string, @Req() req: Request) {
    if (!req.user) throw new BadRequestException('Giriş yapılmamış.');
    return this.games.play(req.user.id, parseType(type));
  }

  /** Logged-in user's own play history. */
  @Get('me/plays')
  @UseGuards(JwtAuthGuard)
  myPlays(@Req() req: Request) {
    if (!req.user) throw new BadRequestException('Giriş yapılmamış.');
    return this.games.listMyPlays(req.user.id);
  }
}
