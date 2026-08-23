import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFlashSaleDto, UpdateFlashSaleDto } from './dto/flash-sale.dto';

export interface ActiveSale {
  id: string;
  salePrice: number;
  startsAt: Date;
  endsAt: Date;
}

@Injectable()
export class FlashSalesService {
  constructor(private prisma: PrismaService) {}

  /** Active sales, keyed by productId, at this moment. */
  async activeMap(productIds: string[]): Promise<Map<string, ActiveSale>> {
    if (productIds.length === 0) return new Map();
    const now = new Date();
    const rows = await this.prisma.flashSale.findMany({
      where: {
        productId: { in: productIds },
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      orderBy: { salePrice: 'asc' },
    });
    const out = new Map<string, ActiveSale>();
    for (const r of rows) {
      // Lowest sale price per product wins if multiple overlap.
      if (!out.has(r.productId)) {
        out.set(r.productId, {
          id: r.id,
          salePrice: Number(r.salePrice),
          startsAt: r.startsAt,
          endsAt: r.endsAt,
        });
      }
    }
    return out;
  }

  async activeFor(productId: string): Promise<ActiveSale | null> {
    const m = await this.activeMap([productId]);
    return m.get(productId) ?? null;
  }

  async list(filter: 'all' | 'active' | 'upcoming' | 'expired' = 'all') {
    const now = new Date();
    const where: any = {};
    if (filter === 'active') {
      where.isActive = true;
      where.startsAt = { lte: now };
      where.endsAt = { gt: now };
    } else if (filter === 'upcoming') {
      where.startsAt = { gt: now };
    } else if (filter === 'expired') {
      where.endsAt = { lte: now };
    }
    const rows = await this.prisma.flashSale.findMany({
      where,
      orderBy: { startsAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            sku: true,
            stockQty: true,
            prices: { select: { tier: true, price: true } },
            images: { where: { isPrimary: true }, take: 1, select: { url: true } },
          },
        },
      },
    });
    return rows.map((r) => {
      const standard = r.product.prices.find((p) => p.tier === 'STANDARD');
      return {
        id: r.id,
        productId: r.productId,
        productName: r.product.name,
        productSlug: r.product.slug,
        productImage: r.product.images[0]?.url ?? null,
        standardPrice: standard ? Number(standard.price) : null,
        salePrice: Number(r.salePrice),
        startsAt: r.startsAt,
        endsAt: r.endsAt,
        isActive: r.isActive,
        stockQty: r.product.stockQty,
      };
    });
  }

  async create(dto: CreateFlashSaleDto) {
    const starts = new Date(dto.startsAt);
    const ends = new Date(dto.endsAt);
    if (ends <= starts) {
      throw new BadRequestException(
        'Bitiş tarihi başlangıçtan sonra olmalıdır.',
      );
    }
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { prices: { where: { tier: 'STANDARD' } } },
    });
    if (!product) throw new NotFoundException('Ürün bulunamadı.');
    const standard = product.prices[0];
    if (standard && Number(standard.price) <= dto.salePrice) {
      throw new BadRequestException(
        'İndirim fiyatı standart fiyattan düşük olmalıdır.',
      );
    }
    return this.prisma.flashSale.create({
      data: {
        productId: dto.productId,
        salePrice: dto.salePrice,
        startsAt: starts,
        endsAt: ends,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateFlashSaleDto) {
    const existing = await this.prisma.flashSale.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Kampanya bulunamadı.');
    const starts = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const ends = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
    if (ends <= starts) {
      throw new BadRequestException(
        'Bitiş tarihi başlangıçtan sonra olmalıdır.',
      );
    }
    return this.prisma.flashSale.update({
      where: { id },
      data: {
        salePrice: dto.salePrice ?? undefined,
        startsAt: dto.startsAt ? starts : undefined,
        endsAt: dto.endsAt ? ends : undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
  }

  async delete(id: string) {
    await this.prisma.flashSale.delete({ where: { id } });
    return { id, deleted: true };
  }

  /** Public-facing list of currently active sales for the home banner. */
  async publicActive(limit = 12) {
    const rows = await this.list('active');
    return rows.slice(0, limit);
  }
}
