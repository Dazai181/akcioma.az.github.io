import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { CategoriesModule } from './categories/categories.module';
import { SyncModule } from './sync/sync.module';
import { ConflictsModule } from './admin/conflicts/conflicts.module';
import { CustomersModule } from './admin/customers/customers.module';
import { UnitsModule } from './admin/units/units.module';
import { AdminGamesModule } from './admin/games/admin-games.module';
import { GamificationModule } from './gamification/gamification.module';
import { TrackingModule } from './tracking/tracking.module';
import { AnalyticsModule } from './admin/analytics/analytics.module';
import { FlashSalesModule } from './flash-sales/flash-sales.module';
import { OrdersModule } from './orders/orders.module';
import { SessionMiddleware } from './common/middleware/session.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    RedisModule,
    AuthModule,
    ProductsModule,
    CartModule,
    CategoriesModule,
    SyncModule,
    ConflictsModule,
    CustomersModule,
    UnitsModule,
    GamificationModule,
    AdminGamesModule,
    TrackingModule,
    AnalyticsModule,
    FlashSalesModule,
    OrdersModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SessionMiddleware).forRoutes('*');
  }
}
