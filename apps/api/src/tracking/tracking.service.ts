import { Injectable, Logger } from '@nestjs/common';
import { Prisma, TrackEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TrackEventDto } from './dto/track-event.dto';

interface IngestScope {
  userId: string | null;
  sessionId: string;
  userAgent?: string | null;
  ip?: string | null;
}

const RECENT_PRODUCTS_CAP = 50;

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private prisma: PrismaService) {}

  async ingest(events: TrackEventDto[], scope: IngestScope): Promise<{ accepted: number }> {
    if (!events.length) return { accepted: 0 };

    const rows: Prisma.TrackEventCreateManyInput[] = events.map((e) => ({
      userId: scope.userId,
      sessionId: scope.sessionId,
      type: e.type,
      productId: e.productId ?? null,
      payload: e.payload ? (e.payload as Prisma.InputJsonValue) : Prisma.JsonNull,
      userAgent: scope.userAgent?.slice(0, 500) ?? null,
      ip: scope.ip?.slice(0, 64) ?? null,
      createdAt: e.occurredAt ? new Date(e.occurredAt) : new Date(),
    }));

    await this.prisma.trackEvent.createMany({ data: rows, skipDuplicates: false });

    // For logged-in users, maintain a recent-products list used by the
    // personalized "Just for You" feed. Cap at RECENT_PRODUCTS_CAP, dedupe
    // (move to front), drop the oldest.
    if (scope.userId) {
      const viewedIds = events
        .filter((e) => e.type === 'PRODUCT_VIEW' && e.productId)
        .map((e) => e.productId as string);
      if (viewedIds.length) {
        await this.updateRecentProducts(scope.userId, viewedIds).catch((err) => {
          this.logger.warn(`recentProducts update failed: ${err?.message ?? err}`);
        });
      }
    }

    return { accepted: rows.length };
  }

  private async updateRecentProducts(userId: string, newViewedIds: string[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { recentProducts: true },
    });
    if (!user) return;

    const existing = Array.isArray(user.recentProducts)
      ? (user.recentProducts as Array<{ productId: string; viewedAt: number }>)
      : [];

    const now = Date.now();
    // Newest first, deduplicated by productId.
    const seen = new Set<string>();
    const merged: Array<{ productId: string; viewedAt: number }> = [];
    for (const id of [...newViewedIds].reverse()) {
      if (!seen.has(id)) {
        seen.add(id);
        merged.push({ productId: id, viewedAt: now });
      }
    }
    for (const entry of existing) {
      if (entry?.productId && !seen.has(entry.productId)) {
        seen.add(entry.productId);
        merged.push(entry);
      }
      if (merged.length >= RECENT_PRODUCTS_CAP) break;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { recentProducts: merged as unknown as Prisma.InputJsonValue },
    });
  }

  // Used by AnalyticsService — exposed here so all event reads go through one type-safe wrapper.
  countByType(types: TrackEventType[], since: Date) {
    return this.prisma.trackEvent.groupBy({
      by: ['type'],
      where: { type: { in: types }, createdAt: { gte: since } },
      _count: { _all: true },
    });
  }
}
