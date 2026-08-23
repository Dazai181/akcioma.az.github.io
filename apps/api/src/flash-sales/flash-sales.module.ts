import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FlashSalesService } from './flash-sales.service';
import { FlashSalesController } from './flash-sales.controller';

@Module({
  imports: [PrismaModule],
  controllers: [FlashSalesController],
  providers: [FlashSalesService],
  exports: [FlashSalesService],
})
export class FlashSalesModule {}
