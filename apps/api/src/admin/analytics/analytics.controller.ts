import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TrackEventType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../auth/guards/admin.guard';
import { AnalyticsService } from './analytics.service';

const VALID_EVENT_TYPES: TrackEventType[] = [
  'PRODUCT_VIEW',
  'PRODUCT_CLICK',
  'ADD_TO_CART',
  'REMOVE_FROM_CART',
  'CART_ABANDON',
  'SEARCH',
  'CHECKOUT_START',
  'CHECKOUT_COMPLETE',
];

function parseDays(s: string | undefined, def = 7): number {
  const n = Number(s ?? def);
  if (!Number.isFinite(n) || n < 1 || n > 365) {
    throw new BadRequestException('days 1 ile 365 arasında olmalı.');
  }
  return n;
}

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('summary')
  summary(@Query('days') days?: string) {
    return this.analytics.summary(parseDays(days));
  }

  @Get('funnel')
  funnel(@Query('days') days?: string) {
    return this.analytics.funnel(parseDays(days));
  }

  @Get('top-products')
  top(@Query('days') days?: string, @Query('type') type?: string) {
    const t = (type ?? 'PRODUCT_VIEW') as TrackEventType;
    if (!VALID_EVENT_TYPES.includes(t)) {
      throw new BadRequestException('Geçersiz event tipi.');
    }
    return this.analytics.topProducts(parseDays(days), t);
  }

  @Get('recent-events')
  recent() {
    return this.analytics.recentEvents(50);
  }

  @Get('abandoned-carts')
  abandoned(@Query('hours') hours?: string) {
    const h = Number(hours ?? 1);
    if (!Number.isFinite(h) || h < 1 || h > 24 * 30) {
      throw new BadRequestException('hours 1 ile 720 arasında olmalı.');
    }
    return this.analytics.abandonedCarts(h);
  }
}
