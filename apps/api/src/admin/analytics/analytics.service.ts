import { Injectable } from '@nestjs/common';
import { Prisma, TrackEventType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const FUNNEL_STEPS: TrackEventType[] = [
  'PRODUCT_VIEW',
  'PRODUCT_CLICK',
  'ADD_TO_CART',
  'CHECKOUT_START',
  'CHECKOUT_COMPLETE',
];

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /** Funnel based on distinct (userId or sessionId) per step. */
  async funnel(sinceDays: number) {
    const since = new Date(Date.now() - sinceDays * 86_400_000);
    const out: { step: TrackEventType; uniques: number; total: number }[] = [];

    for (const step of FUNNEL_STEPS) {
      const [uniques, total] = await Promise.all([
        // Distinct sessions reaching this step
        this.prisma.trackEvent
          .findMany({
            where: { type: step, createdAt: { gte: since } },
            distinct: ['sessionId'],
            select: { sessionId: true },
          })
          .then((r) => r.length),
        this.prisma.trackEvent.count({
          where: { type: step, createdAt: { gte: since } },
        }),
      ]);
      out.push({ step, uniques, total });
    }
    return out;
  }

  async topProducts(sinceDays: number, type: TrackEventType = 'PRODUCT_VIEW', limit = 10) {
    const since = new Date(Date.now() - sinceDays * 86_400_000);
    const grouped = await this.prisma.trackEvent.groupBy({
      by: ['productId'],
      where: { type, createdAt: { gte: since }, productId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { productId: 'desc' } },
      take: limit,
    });
    const ids = grouped.map((g) => g.productId!).filter(Boolean);
    if (!ids.length) return [];
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        slug: true,
        images: { where: { isPrimary: true }, take: 1, select: { url: true } },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    return grouped.map((g) => {
      const p = byId.get(g.productId!);
      return {
        productId: g.productId,
        name: p?.name ?? '—',
        slug: p?.slug ?? '',
        image: p?.images[0]?.url ?? null,
        count: g._count._all,
      };
    });
  }

  async recentEvents(limit = 50) {
    const events = await this.prisma.trackEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        productId: true,
        sessionId: true,
        userId: true,
        createdAt: true,
        payload: true,
      },
    });

    const productIds = Array.from(
      new Set(events.map((e) => e.productId).filter(Boolean) as string[]),
    );
    const userIds = Array.from(
      new Set(events.map((e) => e.userId).filter(Boolean) as string[]),
    );

    const [products, users] = await Promise.all([
      productIds.length
        ? this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, slug: true },
          })
        : [],
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true, mobile: true },
          })
        : [],
    ]);
    const pById = new Map(products.map((p) => [p.id, p] as const));
    const uById = new Map(users.map((u) => [u.id, u] as const));

    return events.map((e) => ({
      id: e.id,
      type: e.type,
      createdAt: e.createdAt,
      sessionId: e.sessionId.slice(0, 8),
      user: e.userId
        ? {
            id: e.userId,
            name: uById.get(e.userId)
              ? `${uById.get(e.userId)!.firstName} ${uById.get(e.userId)!.lastName}`
              : '—',
            mobile: uById.get(e.userId)?.mobile,
          }
        : null,
      product: e.productId
        ? {
            id: e.productId,
            name: pById.get(e.productId)?.name ?? '—',
            slug: pById.get(e.productId)?.slug ?? '',
          }
        : null,
      payload: e.payload,
    }));
  }

  async summary(sinceDays: number) {
    const since = new Date(Date.now() - sinceDays * 86_400_000);
    const [activeSessions, totalEvents, addToCart, checkoutStart] = await Promise.all([
      this.prisma.trackEvent
        .findMany({
          where: { createdAt: { gte: since } },
          distinct: ['sessionId'],
          select: { sessionId: true },
        })
        .then((r) => r.length),
      this.prisma.trackEvent.count({ where: { createdAt: { gte: since } } }),
      this.prisma.trackEvent.count({
        where: { type: 'ADD_TO_CART', createdAt: { gte: since } },
      }),
      this.prisma.trackEvent.count({
        where: { type: 'CHECKOUT_START', createdAt: { gte: since } },
      }),
    ]);
    return { activeSessions, totalEvents, addToCart, checkoutStart, sinceDays };
  }

  /** Carts that have items but no CHECKOUT_COMPLETE in the past N hours. */
  async abandonedCarts(staleHours: number = 1) {
    const cutoff = new Date(Date.now() - staleHours * 3_600_000);

    // Find carts updated before cutoff that still have items.
    const carts = await this.prisma.cart.findMany({
      where: {
        updatedAt: { lt: cutoff },
        items: { some: {} },
      },
      include: {
        items: { select: { quantity: true, priceSnapshot: true } },
        user: {
          select: { id: true, firstName: true, lastName: true, mobile: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    return carts.map((c) => {
      const subtotal = c.items.reduce(
        (s, it) => s + Number(it.priceSnapshot) * it.quantity,
        0,
      );
      return {
        cartId: c.id,
        userId: c.userId,
        user: c.user,
        isGuest: c.userId == null,
        itemCount: c.items.reduce((s, it) => s + it.quantity, 0),
        subtotal,
        lastTouchedAt: c.updatedAt,
      };
    });
  }
}
