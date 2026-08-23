import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { CartService, CartScope } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart-item.dto';

function scopeFromReq(req: Request): CartScope {
  return {
    user: req.user ?? null,
    sessionToken: req.aksSession ?? '',
  };
}

@Controller('cart')
@UseGuards(OptionalJwtGuard)
export class CartController {
  constructor(private cart: CartService) {}

  @Get()
  get(@Req() req: Request) {
    return this.cart.getCart(scopeFromReq(req));
  }

  @Post('items')
  addItem(@Req() req: Request, @Body() dto: AddCartItemDto) {
    return this.cart.addItem(scopeFromReq(req), dto.productId, dto.quantity);
  }

  @Patch('items/:id')
  updateItem(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cart.updateItem(scopeFromReq(req), id, dto.quantity);
  }

  @Delete('items/:id')
  removeItem(@Req() req: Request, @Param('id') id: string) {
    return this.cart.removeItem(scopeFromReq(req), id);
  }

  @Delete()
  clear(@Req() req: Request) {
    return this.cart.clear(scopeFromReq(req));
  }

  /** Merge guest cart (cookie session) into the user's cart. Call right after login. */
  @Post('merge')
  @UseGuards(JwtAuthGuard)
  async merge(@Req() req: Request) {
    if (!req.user) throw new BadRequestException('Giriş yapılmamış.');
    await this.cart.mergeGuestIntoUser(req.aksSession, req.user.id);
    return this.cart.getCart(scopeFromReq(req));
  }
}
