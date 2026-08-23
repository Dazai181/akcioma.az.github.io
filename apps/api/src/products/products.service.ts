import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CustomerTier, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FlashSalesService, ActiveSale } from '../flash-sales/flash-sales.service';
import { ListProductsDto } from './dto/list-products.dto';
import { UpsertProductDto } from './dto/upsert-product.dto';
import { resolvePrice, ResolvedPrice } from './pricing.util';

const FOMO_THRESHOLD = 5;

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private flashSales: FlashSalesService,
  ) {}

  async list(query: ListProductsDto, userTier: CustomerTier) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const where: Prisma.ProductWhereInput = { isVisible: true };

    if (query.category) {
      where.category = { slug: query.category, isVisible: true };
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          prices: { select: { tier: true, price: true } },
          images: { where: { isPrimary: true }, take: 1, select: { url: true } },
          category: { select: { name: true, slug: true } },
          unit: { select: { code: true, name: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    const sales = await this.flashSales.activeMap(items.map((p) => p.id));
    return {
      items: items.map((p) => this.shape(p, userTier, false, sales.get(p.id))),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  async getBySlug(slug: string, userTier: CustomerTier) {
    const product = await this.prisma.product.findFirst({
      where: { slug, isVisible: true },
      include: {
        prices: { select: { tier: true, price: true } },
        images: { orderBy: { isPrimary: 'desc' }, select: { url: true } },
        category: { select: { name: true, slug: true } },
        unit: { select: { code: true, name: true } },
      },
    });
    if (!product) throw new NotFoundException('Ürün bulunamadı.');
    const sale = await this.flashSales.activeFor(product.id);
    return this.shape(product, userTier, true, sale ?? undefined);
  }

  async featured(userTier: CustomerTier) {
    const items = await this.prisma.product.findMany({
      where: { isVisible: true, stockQty: { gt: 0 } },
      take: 12,
      orderBy: { createdAt: 'desc' },
      include: {
        prices: { select: { tier: true, price: true } },
        images: { where: { isPrimary: true }, take: 1, select: { url: true } },
        category: { select: { name: true, slug: true } },
        unit: { select: { code: true, name: true } },
      },
    });
    const sales = await this.flashSales.activeMap(items.map((p) => p.id));
    return items.map((p) => this.shape(p, userTier, false, sales.get(p.id)));
  }

  /**
   * Personalized feed:
   *   - Logged-in user with recent views → other in-stock products from the
   *     same categories, excluding those they already viewed recently
   *   - Otherwise → trending in the last 7 days (most PRODUCT_VIEW events)
   *   - Fallback → newest products
   */
  async recommended(userId: string | null, userTier: CustomerTier, limit = 12) {
    if (userId) {
      const personalized = await this.personalizedForUser(userId, userTier, limit);
      if (personalized.length) return personalized;
    }
    const trending = await this.trending(userTier, limit);
    if (trending.length) return trending;
    return this.featured(userTier);
  }

  private async personalizedForUser(
    userId: string,
    userTier: CustomerTier,
    limit: number,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { recentProducts: true },
    });
    const recent = Array.isArray(user?.recentProducts)
      ? (user!.recentProducts as Array<{ productId: string }>)
      : [];
    const recentIds = recent.map((r) => r.productId).filter(Boolean);
    if (!recentIds.length) return [];

    // Categories of the recently-viewed products.
    const seedProducts = await this.prisma.product.findMany({
      where: { id: { in: recentIds.slice(0, 20) } },
      select: { categoryId: true },
    });
    const categoryIds = Array.from(new Set(seedProducts.map((p) => p.categoryId)));
    if (!categoryIds.length) return [];

    const items = await this.prisma.product.findMany({
      where: {
        isVisible: true,
        stockQty: { gt: 0 },
        categoryId: { in: categoryIds },
        id: { notIn: recentIds },
      },
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        prices: { select: { tier: true, price: true } },
        images: { where: { isPrimary: true }, take: 1, select: { url: true } },
        category: { select: { name: true, slug: true } },
        unit: { select: { code: true, name: true } },
      },
    });
    const sales = await this.flashSales.activeMap(items.map((p) => p.id));
    return items.map((p) => this.shape(p, userTier, false, sales.get(p.id)));
  }

  private async trending(userTier: CustomerTier, limit: number) {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const top = await this.prisma.trackEvent.groupBy({
      by: ['productId'],
      where: { type: 'PRODUCT_VIEW', createdAt: { gte: since }, productId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { productId: 'desc' } },
      take: limit,
    });
    const ids = top.map((t) => t.productId!).filter(Boolean);
    if (!ids.length) return [];

    const items = await this.prisma.product.findMany({
      where: { id: { in: ids }, isVisible: true, stockQty: { gt: 0 } },
      include: {
        prices: { select: { tier: true, price: true } },
        images: { where: { isPrimary: true }, take: 1, select: { url: true } },
        category: { select: { name: true, slug: true } },
        unit: { select: { code: true, name: true } },
      },
    });
    // Preserve trending order.
    const order = new Map(ids.map((id, i) => [id, i]));
    items.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
    const sales = await this.flashSales.activeMap(items.map((p) => p.id));
    return items.map((p) => this.shape(p, userTier, false, sales.get(p.id)));
  }

  async create(dto: UpsertProductDto) {
    const slug = await this.uniqueSlug(dto.name);
    this.validateTierPrices(dto);
    const unitId = await this.resolveUnitId(dto.unitCode);
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          barcode: dto.barcode,
          sku: dto.sku,
          stockQty: dto.stockQty,
          isVisible: dto.isVisible ?? true,
          categoryId: dto.categoryId,
          unitId: unitId ?? undefined,
          prices: { create: dto.prices.map((p) => ({ tier: p.tier, price: p.price })) },
          images: dto.imageUrls?.length
            ? {
                create: dto.imageUrls.map((url, i) => ({
                  url,
                  isPrimary: i === 0,
                })),
              }
            : undefined,
        },
        include: {
          prices: { select: { tier: true, price: true } },
          images: { select: { url: true, isPrimary: true } },
          category: { select: { name: true, slug: true } },
          unit: { select: { code: true, name: true } },
        },
      });
      return this.shape(product, 'STANDARD', true);
    });
  }

  async update(id: string, dto: UpsertProductDto) {
    this.validateTierPrices(dto);
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ürün bulunamadı.');
    const unitId = await this.resolveUnitId(dto.unitCode);

    return this.prisma.$transaction(async (tx) => {
      await tx.productPrice.deleteMany({ where: { productId: id } });
      const product = await tx.product.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
          barcode: dto.barcode,
          sku: dto.sku,
          stockQty: dto.stockQty,
          isVisible: dto.isVisible ?? existing.isVisible,
          categoryId: dto.categoryId,
          unitId: unitId ?? undefined,
          prices: { create: dto.prices.map((p) => ({ tier: p.tier, price: p.price })) },
        },
        include: {
          prices: { select: { tier: true, price: true } },
          images: { select: { url: true, isPrimary: true } },
          category: { select: { name: true, slug: true } },
          unit: { select: { code: true, name: true } },
        },
      });
      return this.shape(product, 'STANDARD', true);
    });
  }

  private async resolveUnitId(code?: string): Promise<string | null> {
    if (!code) return null;
    const normalized = code.trim().toLowerCase();
    if (!normalized) return null;
    const u = await this.prisma.unit.upsert({
      where: { code: normalized },
      update: {},
      create: { code: normalized, name: code.trim(), isSystem: false },
    });
    return u.id;
  }

  async setVisibility(id: string, isVisible: boolean) {
    await this.prisma.product.update({ where: { id }, data: { isVisible } });
    return { id, isVisible };
  }

  /** Admin: list ALL products (including hidden), with optional search + filter. */
  async adminList(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    visibility?: 'all' | 'visible' | 'hidden';
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 25;
    const where: Prisma.ProductWhereInput = {};

    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.visibility === 'visible') where.isVisible = true;
    if (params.visibility === 'hidden') where.isVisible = false;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { sku: { contains: params.search, mode: 'insensitive' } },
        { barcode: { contains: params.search } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          prices: { select: { tier: true, price: true } },
          category: { select: { id: true, name: true, slug: true } },
          unit: { select: { id: true, code: true, name: true } },
          images: { where: { isPrimary: true }, take: 1, select: { url: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        barcode: p.barcode,
        stockQty: p.stockQty,
        isVisible: p.isVisible,
        category: p.category,
        unit: p.unit,
        image: p.images[0]?.url ?? null,
        prices: p.prices.map((pp) => ({ tier: pp.tier, price: Number(pp.price) })),
        updatedAt: p.updatedAt,
      })),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  /** Admin: full product detail including hidden + tier prices + ids. */
  async adminGet(id: string) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: {
        prices: { select: { tier: true, price: true } },
        category: { select: { id: true, name: true, slug: true } },
        unit: { select: { id: true, code: true, name: true } },
        images: { select: { url: true, isPrimary: true } },
      },
    });
    if (!p) throw new NotFoundException('Ürün bulunamadı.');
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      sku: p.sku,
      barcode: p.barcode,
      stockQty: p.stockQty,
      isVisible: p.isVisible,
      categoryId: p.categoryId,
      category: p.category,
      unitId: p.unitId,
      unit: p.unit,
      images: p.images,
      prices: p.prices.map((pp) => ({ tier: pp.tier, price: Number(pp.price) })),
      lastSyncedAt: p.lastSyncedAt,
      lastSyncSource: p.lastSyncSource,
      updatedAt: p.updatedAt,
    };
  }

  async delete(id: string) {
    await this.prisma.product.delete({ where: { id } });
    return { id, deleted: true };
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private shape(
    product: any,
    userTier: CustomerTier,
    full = false,
    flashSale?: ActiveSale,
  ): any {
    const resolved: ResolvedPrice = resolvePrice(
      product.prices,
      userTier,
      flashSale ?? null,
    );
    const isLowStock =
      product.stockQty > 0 && product.stockQty <= FOMO_THRESHOLD;
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: full ? product.description : undefined,
      stockQty: product.stockQty,
      isLowStock,
      lowStockTag: isLowStock ? `Son ${product.stockQty} adet!` : null,
      price: resolved,
      category: product.category,
      images: full
        ? product.images.map((i: any) => i.url)
        : product.images?.[0]?.url ?? null,
      unit: product.unit ? { code: product.unit.code, name: product.unit.name } : null,
      barcode: full ? product.barcode : undefined,
      sku: full ? product.sku : undefined,
    };
  }

  private validateTierPrices(dto: UpsertProductDto) {
    const tiers = new Set(dto.prices.map((p) => p.tier));
    if (!tiers.has('STANDARD')) {
      throw new ConflictException('Ürün için STANDARD fiyat gereklidir.');
    }
    if (tiers.size !== dto.prices.length) {
      throw new ConflictException('Aynı tier için birden fazla fiyat verilemez.');
    }
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 80) || 'urun';
    let slug = base;
    let n = 1;
    while (await this.prisma.product.findUnique({ where: { slug } })) {
      slug = `${base}-${++n}`;
    }
    return slug;
  }
}
