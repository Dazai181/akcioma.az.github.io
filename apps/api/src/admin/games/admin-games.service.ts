import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GameType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateGameDto, UpsertRewardDto } from './dto/game-config.dto';

@Injectable()
export class AdminGamesService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const games = await this.prisma.game.findMany({
      orderBy: { type: 'asc' },
      include: {
        rewards: { orderBy: { id: 'asc' } },
        _count: { select: { plays: true, rewards: true } },
      },
    });
    return games.map((g) => ({
      ...g,
      rewards: g.rewards.map((r) => ({
        ...r,
        value: r.value != null ? Number(r.value) : null,
        probability: this.probability(r.weight, g.rewards),
      })),
    }));
  }

  async get(type: GameType) {
    const game = await this.prisma.game.findUnique({
      where: { type },
      include: {
        rewards: { orderBy: { id: 'asc' } },
        _count: { select: { plays: true } },
      },
    });
    if (!game) throw new NotFoundException('Oyun bulunamadı.');
    return {
      ...game,
      rewards: game.rewards.map((r) => ({
        ...r,
        value: r.value != null ? Number(r.value) : null,
        probability: this.probability(r.weight, game.rewards),
      })),
    };
  }

  async update(type: GameType, dto: UpdateGameDto) {
    const game = await this.prisma.game.findUnique({ where: { type } });
    if (!game) throw new NotFoundException('Oyun bulunamadı.');

    const config = (game.config ?? {}) as Record<string, unknown>;
    if (dto.cooldownHours !== undefined) config.cooldownHours = dto.cooldownHours;
    if (dto.maxPlaysPerDay !== undefined) config.maxPlaysPerDay = dto.maxPlaysPerDay;

    return this.prisma.game.update({
      where: { type },
      data: {
        isEnabled: dto.isEnabled ?? game.isEnabled,
        config: config as Prisma.InputJsonValue,
      },
      include: {
        rewards: { orderBy: { id: 'asc' } },
      },
    });
  }

  async addReward(type: GameType, dto: UpsertRewardDto) {
    const game = await this.prisma.game.findUnique({ where: { type } });
    if (!game) throw new NotFoundException('Oyun bulunamadı.');
    return this.prisma.gameReward.create({
      data: {
        gameId: game.id,
        label: dto.label.trim(),
        type: dto.type,
        value: dto.value ?? null,
        weight: dto.weight,
        couponCode: dto.couponCode?.trim() || null,
        isEnabled: dto.isEnabled ?? true,
      },
    });
  }

  async updateReward(rewardId: string, dto: UpsertRewardDto) {
    const reward = await this.prisma.gameReward.findUnique({ where: { id: rewardId } });
    if (!reward) throw new NotFoundException('Ödül bulunamadı.');
    return this.prisma.gameReward.update({
      where: { id: rewardId },
      data: {
        label: dto.label.trim(),
        type: dto.type,
        value: dto.value ?? null,
        weight: dto.weight,
        couponCode: dto.couponCode?.trim() || null,
        isEnabled: dto.isEnabled ?? reward.isEnabled,
      },
    });
  }

  async deleteReward(rewardId: string) {
    const reward = await this.prisma.gameReward.findUnique({
      where: { id: rewardId },
      include: { _count: { select: { plays: true } } },
    });
    if (!reward) throw new NotFoundException('Ödül bulunamadı.');
    if (reward._count.plays > 0) {
      throw new BadRequestException(
        `Bu ödül ${reward._count.plays} kez verilmiş — geçmişi korumak için silmek yerine "isEnabled=false" yapın.`,
      );
    }
    await this.prisma.gameReward.delete({ where: { id: rewardId } });
    return { id: rewardId, deleted: true };
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private probability(
    weight: number,
    allRewards: { weight: number; isEnabled: boolean }[],
  ): number {
    const totalEnabled = allRewards
      .filter((r) => r.isEnabled)
      .reduce((s, r) => s + Math.max(0, r.weight), 0);
    if (totalEnabled <= 0) return 0;
    return Math.round((Math.max(0, weight) / totalEnabled) * 10000) / 100;
  }
}
