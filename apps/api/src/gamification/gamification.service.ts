import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Game, GameReward, GameType, RewardType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PublicGameView {
  type: GameType;
  isEnabled: boolean;
  config: { cooldownHours?: number; maxPlaysPerDay?: number } & Record<string, unknown>;
  rewards: PublicReward[];
  canPlay: boolean;
  cooldownEndsAt: string | null; // ISO when current cooldown ends
  remainingPlaysToday: number | null;
}

export interface PublicReward {
  id: string;
  label: string;
  type: RewardType;
  value: number | null;
}

export interface PlayResult {
  gameType: GameType;
  awardedAt: string;
  reward: {
    id: string;
    label: string;
    type: RewardType;
    value: number | null;
    couponCode: string | null;
  };
  // Index into the public rewards array — used by the SpinWheel UI to
  // animate to the right slot. Computed deterministically client-side too.
  rewardIndex: number;
}

@Injectable()
export class GamificationService {
  constructor(private prisma: PrismaService) {}

  // ── Public read ────────────────────────────────────────────────────────

  async getPublicView(type: GameType, userId: string | null): Promise<PublicGameView> {
    const game = await this.prisma.game.findUnique({
      where: { type },
      include: {
        rewards: {
          where: { isEnabled: true },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!game) throw new NotFoundException('Oyun bulunamadı.');

    const cfg = (game.config ?? {}) as PublicGameView['config'];
    const eligibility = userId
      ? await this.computeEligibility(game, userId)
      : { canPlay: false, cooldownEndsAt: null, remainingPlaysToday: null };

    return {
      type: game.type,
      isEnabled: game.isEnabled,
      config: cfg,
      rewards: game.rewards.map(this.toPublicReward),
      ...eligibility,
    };
  }

  async listMyPlays(userId: string, limit = 20) {
    return this.prisma.gamePlay.findMany({
      where: { userId },
      orderBy: { awardedAt: 'desc' },
      take: limit,
      include: {
        game: { select: { type: true } },
        reward: {
          select: { id: true, label: true, type: true, value: true, couponCode: true },
        },
      },
    });
  }

  // ── Play ───────────────────────────────────────────────────────────────

  async play(userId: string, type: GameType): Promise<PlayResult> {
    const game = await this.prisma.game.findUnique({
      where: { type },
      include: {
        rewards: {
          where: { isEnabled: true },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!game) throw new NotFoundException('Oyun bulunamadı.');
    if (!game.isEnabled) {
      throw new BadRequestException('Bu oyun şu anda aktif değil.');
    }
    if (game.rewards.length === 0) {
      throw new BadRequestException('Oyun yapılandırması eksik (ödül yok).');
    }

    const eligibility = await this.computeEligibility(game, userId);
    if (!eligibility.canPlay) {
      throw new BadRequestException(
        eligibility.cooldownEndsAt
          ? 'Tekrar oynamak için süre dolmadı.'
          : 'Günlük hak doldu.',
      );
    }

    const totalWeight = game.rewards.reduce((s, r) => s + Math.max(0, r.weight), 0);
    if (totalWeight <= 0) {
      throw new BadRequestException('Oyun yapılandırması eksik (toplam ağırlık 0).');
    }

    const reward = this.weightedPick(game.rewards, totalWeight);
    const rewardIndex = game.rewards.findIndex((r) => r.id === reward.id);

    const play = await this.prisma.gamePlay.create({
      data: { gameId: game.id, userId, rewardId: reward.id },
    });

    return {
      gameType: game.type,
      awardedAt: play.awardedAt.toISOString(),
      reward: {
        id: reward.id,
        label: reward.label,
        type: reward.type,
        value: reward.value != null ? Number(reward.value) : null,
        couponCode: reward.couponCode,
      },
      rewardIndex,
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private toPublicReward(r: GameReward): PublicReward {
    return {
      id: r.id,
      label: r.label,
      type: r.type,
      value: r.value != null ? Number(r.value) : null,
    };
  }

  private weightedPick(rewards: GameReward[], totalWeight: number): GameReward {
    let n = Math.random() * totalWeight;
    for (const r of rewards) {
      const w = Math.max(0, r.weight);
      if ((n -= w) <= 0) return r;
    }
    return rewards[rewards.length - 1];
  }

  private async computeEligibility(
    game: Game,
    userId: string,
  ): Promise<{
    canPlay: boolean;
    cooldownEndsAt: string | null;
    remainingPlaysToday: number | null;
  }> {
    const cfg = (game.config ?? {}) as {
      cooldownHours?: number;
      maxPlaysPerDay?: number;
    };

    let cooldownEndsAt: string | null = null;
    if (cfg.cooldownHours && cfg.cooldownHours > 0) {
      const last = await this.prisma.gamePlay.findFirst({
        where: { userId, gameId: game.id },
        orderBy: { awardedAt: 'desc' },
      });
      if (last) {
        const ends = new Date(
          last.awardedAt.getTime() + cfg.cooldownHours * 3_600_000,
        );
        if (ends.getTime() > Date.now()) {
          cooldownEndsAt = ends.toISOString();
        }
      }
    }

    let remainingPlaysToday: number | null = null;
    if (cfg.maxPlaysPerDay && cfg.maxPlaysPerDay > 0) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const playsToday = await this.prisma.gamePlay.count({
        where: { userId, gameId: game.id, awardedAt: { gte: startOfDay } },
      });
      remainingPlaysToday = Math.max(0, cfg.maxPlaysPerDay - playsToday);
    }

    const canPlay =
      !cooldownEndsAt &&
      (remainingPlaysToday == null || remainingPlaysToday > 0);

    return { canPlay, cooldownEndsAt, remainingPlaysToday };
  }
}
