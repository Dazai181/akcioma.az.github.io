export type GameType = 'DAILY_CHECKIN' | 'SPIN_WHEEL' | 'SCRATCH_CARD';

export type RewardType =
  | 'DISCOUNT_PERCENT'
  | 'DISCOUNT_FIXED'
  | 'FREE_SHIPPING'
  | 'POINTS'
  | 'COUPON_CODE'
  | 'NOTHING';

export interface PublicReward {
  id: string;
  label: string;
  type: RewardType;
  value: number | null;
}

export interface PublicGameView {
  type: GameType;
  isEnabled: boolean;
  config: { cooldownHours?: number; maxPlaysPerDay?: number };
  rewards: PublicReward[];
  canPlay: boolean;
  cooldownEndsAt: string | null;
  remainingPlaysToday: number | null;
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
  rewardIndex: number;
}

export const TYPE_TO_PARAM: Record<GameType, string> = {
  DAILY_CHECKIN: 'daily-checkin',
  SPIN_WHEEL: 'spin-wheel',
  SCRATCH_CARD: 'scratch-card',
};
