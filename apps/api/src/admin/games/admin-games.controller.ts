import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { GameType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AdminGamesService } from './admin-games.service';
import { UpdateGameDto, UpsertRewardDto } from './dto/game-config.dto';

const VALID_TYPES: GameType[] = ['DAILY_CHECKIN', 'SPIN_WHEEL', 'SCRATCH_CARD'];

function parseType(raw: string): GameType {
  const t = raw.toUpperCase().replace(/-/g, '_') as GameType;
  if (!VALID_TYPES.includes(t)) {
    throw new BadRequestException('Geçersiz oyun türü.');
  }
  return t;
}

@Controller('admin/games')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminGamesController {
  constructor(private games: AdminGamesService) {}

  @Get()
  list() {
    return this.games.list();
  }

  @Get(':type')
  get(@Param('type') type: string) {
    return this.games.get(parseType(type));
  }

  @Patch(':type')
  update(@Param('type') type: string, @Body() dto: UpdateGameDto) {
    return this.games.update(parseType(type), dto);
  }

  @Post(':type/rewards')
  addReward(@Param('type') type: string, @Body() dto: UpsertRewardDto) {
    return this.games.addReward(parseType(type), dto);
  }

  @Put('rewards/:rewardId')
  updateReward(@Param('rewardId') id: string, @Body() dto: UpsertRewardDto) {
    return this.games.updateReward(id, dto);
  }

  @Delete('rewards/:rewardId')
  deleteReward(@Param('rewardId') id: string) {
    return this.games.deleteReward(id);
  }
}
