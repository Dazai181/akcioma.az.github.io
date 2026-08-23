import { CustomerTier, Prisma } from '@prisma/client';

export interface FlashSaleSnapshot {
  id: string;
  salePrice: number;
  startsAt: Date;
  endsAt: Date;
}

export interface ResolvedPrice {
  finalPrice: number;
  originalPrice: number;
  discountPercent: number;
  appliedTier: CustomerTier;
  flashSale: {
    id: string;
    endsAt: string;
    startsAt: string;
  } | null;
}

type PriceRow = { tier: CustomerTier; price: Prisma.Decimal | number | string };

export function resolvePrice(
  prices: PriceRow[],
  userTier: CustomerTier = 'STANDARD',
  flashSale: FlashSaleSnapshot | null = null,
): ResolvedPrice {
  const byTier = new Map<CustomerTier, number>(
    prices.map((p) => [p.tier, Number(p.price)]),
  );
  const standard = byTier.get('STANDARD');
  if (standard == null) {
    throw new Error('STANDARD price missing for product (data integrity).');
  }

  const candidates: { tier: CustomerTier; value: number }[] = [
    { tier: 'STANDARD', value: standard },
  ];
  if (userTier === 'FAVORITE' || userTier === 'SPECIAL') {
    const fav = byTier.get('FAVORITE');
    if (fav != null) candidates.push({ tier: 'FAVORITE', value: fav });
  }
  if (userTier === 'SPECIAL') {
    const special = byTier.get('SPECIAL');
    if (special != null) candidates.push({ tier: 'SPECIAL', value: special });
  }

  let best = candidates.reduce((a, b) => (b.value < a.value ? b : a));
  let flashApplied = false;
  if (flashSale && flashSale.salePrice < best.value) {
    best = { tier: best.tier, value: flashSale.salePrice };
    flashApplied = true;
  }

  const discountPercent =
    standard > 0 ? Math.round((1 - best.value / standard) * 100) : 0;

  return {
    finalPrice: best.value,
    originalPrice: standard,
    discountPercent,
    appliedTier: best.tier,
    flashSale: flashApplied && flashSale
      ? {
          id: flashSale.id,
          startsAt: flashSale.startsAt.toISOString(),
          endsAt: flashSale.endsAt.toISOString(),
        }
      : null,
  };
}
