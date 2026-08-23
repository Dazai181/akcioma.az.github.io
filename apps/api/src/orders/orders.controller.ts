import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CheckoutDto } from './dto/checkout.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post('checkout')
  checkout(@Req() req: Request, @Body() dto: CheckoutDto) {
    if (!req.user) throw new BadRequestException('Giriş yapılmamış.');
    return this.orders.checkout(req.user.id, dto);
  }

  @Get()
  list(@Req() req: Request) {
    if (!req.user) throw new BadRequestException('Giriş yapılmamış.');
    return this.orders.listForUser(req.user.id);
  }

  @Get(':idOrCode')
  get(@Req() req: Request, @Param('idOrCode') idOrCode: string) {
    if (!req.user) throw new BadRequestException('Giriş yapılmamış.');
    return this.orders.getForUser(req.user.id, idOrCode);
  }
}
