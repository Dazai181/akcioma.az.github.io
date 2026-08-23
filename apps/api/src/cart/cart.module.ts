import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { FlashSalesModule } from '../flash-sales/flash-sales.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [PassportModule, AuthModule, FlashSalesModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
