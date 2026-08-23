import type { ResolvedPrice, UnitInfo } from '@/lib/types';

const TRY = (n: number) => `₺${n.toFixed(2)}`;

const TIER_LABEL: Record<string, string> = {
  STANDARD: '',
  FAVORITE: 'VIP',
  SPECIAL: 'Özel',
};

export function PriceTag({
  price,
  unit,
  large = false,
}: {
  price: ResolvedPrice;
  unit?: UnitInfo | null;
  large?: boolean;
}) {
  const showStrike = price.discountPercent > 0;
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className={large ? 'text-2xl font-bold text-accent' : 'text-lg font-semibold text-accent'}>
        {TRY(price.finalPrice)}
        {unit && (
          <span className="ml-1 text-xs font-normal" style={{ color: 'var(--aksioma-muted)' }}>
            / {unit.code}
          </span>
        )}
      </span>
      {showStrike && (
        <span className="text-sm line-through" style={{ color: 'var(--aksioma-muted)' }}>
          {TRY(price.originalPrice)}
        </span>
      )}
      {showStrike && (
        <span className="text-xs font-bold rounded px-1.5 py-0.5 bg-accent text-white">
          −{price.discountPercent}%
        </span>
      )}
      {price.appliedTier !== 'STANDARD' && (
        <span className="text-[10px] uppercase font-semibold rounded px-1.5 py-0.5 bg-primary text-white">
          {TIER_LABEL[price.appliedTier]}
        </span>
      )}
    </div>
  );
}
