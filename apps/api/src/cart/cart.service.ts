import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerTier, Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FlashSalesService } from '../flash-sales/flash-sales.service';
import { resolvePrice } from '../products/pricing.util';

export interface CartScope {
  user: User | null;
  sessionToken: string;
}

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private flashSales: FlashSalesService,
  ) {}

  async getCart(scope: CartScope) {
    const cart = await this.findOrCreate(scope);
    return this.shape(cart.id, scope.user?.customerTier ?? 'STANDARD');
  }

  async addItem(
    scope: CartScope,
    productId: string,
    quantity: number,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { prices: { select: { tier: true, price: true } } },
    });
    if (!product || !product.isVisible) {
      throw new NotFoundException('Ürün bulunamadı.');
    }

    const cart = await this.findOrCreate(scope);
    const tier: CustomerTier = scope.user?.customerTier ?? 'STANDARD';
    const sale = await this.flashSales.activeFor(productId);
    const resolved = resolvePrice(product.prices, tier, sale);

    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });
    const desiredQty = (existing?.quantity ?? 0) + quantity;
    if (desiredQty > product.stockQty) {
      throw new ConflictException('Yetersiz stok.');
    }

    await this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: {
        cartId: cart.id,
        productId,
        quantity,
        priceSnapshot: resolved.finalPrice,
      },
      update: {
        quantity: desiredQty,
        priceSnapshot: resolved.finalPrice,
      },
    });

    return this.shape(cart.id, tier);
  }

  async updateItem(
    scope: CartScope,
    itemId: string,
    quantity: number,
  ) {
    const cart = await this.findOrCreate(scope);
    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { product: { select: { stockQty: true } } },
    });
    if (!item || item.cartId !== cart.id) {
      throw new NotFoundException('Sepet öğesi bulunamadı.');
    }
    if (quantity > item.product.stockQty) {
      throw new ConflictException('Yetersiz stok.');
    }
    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });
    return this.shape(cart.id, scope.user?.customerTier ?? 'STANDARD');
  }

  async removeItem(scope: CartScope, itemId: string) {
    const cart = await this.findOrCreate(scope);
    const item = await this.prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item || item.cartId !== cart.id) {
      throw new NotFoundException('Sepet öğesi bulunamadı.');
    }
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.shape(cart.id, scope.user?.customerTier ?? 'STANDARD');
  }

  async clear(scope: CartScope) {
    const cart = await this.findOrCreate(scope);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.shape(cart.id, scope.user?.customerTier ?? 'STANDARD');
  }

  /** Called from auth flows after a guest logs in. Merges guest cart → user cart. */
  async mergeGuestIntoUser(sessionToken: string | undefined, userId: string) {
    if (!sessionToken) return;
    const guestCart = await this.prisma.cart.findUnique({
      where: { sessionToken },
      include: { items: true },
    });
    if (!guestCart || guestCart.items.length === 0) return;

    const userCart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    for (const item of guestCart.items) {
      const existing = await this.prisma.cartItem.findUnique({
        where: {
          cartId_productId: { cartId: userCart.id, productId: item.productId },
        },
      });
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        select: { stockQty: true },
      });
      if (!product) continue;
      const merged = Math.min(
        product.stockQty,
        (existing?.quantity ?? 0) + item.quantity,
      );
      await this.prisma.cartItem.upsert({
        where: {
          cartId_productId: { cartId: userCart.id, productId: item.productId },
        },
        create: {
          cartId: userCart.id,
          productId: item.productId,
          quantity: merged,
          priceSnapshot: item.priceSnapshot,
        },
        update: {
          quantity: merged,
          priceSnapshot: item.priceSnapshot,
        },
      });
    }

    await this.prisma.cart.delete({ where: { id: guestCart.id } });
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private async findOrCreate(scope: CartScope) {
    if (scope.user) {
      return this.prisma.cart.upsert({
        where: { userId: scope.user.id },
        create: { userId: scope.user.id },
        update: {},
      });
    }
    if (!scope.sessionToken) {
      throw new BadRequestException('Oturum belirteci eksik.');
    }
    return this.prisma.cart.upsert({
      where: { sessionToken: scope.sessionToken },
      create: { sessionToken: scope.sessionToken },
      update: {},
    });
  }

  private async shape(cartId: string, userTier: CustomerTier) {
    const cart = await this.prisma.cart.findUniqueOrThrow({
      where: { id: cartId },
      include: {
        items: {
          orderBy: { addedAt: 'desc' },
          include: {
            product: {
              include: {
                prices: { select: { tier: true, price: true } },
                images: {
                  where: { isPrimary: true },
                  take: 1,
                  select: { url: true },
                },
                unit: { select: { code: true, name: true } },
              },
            },
          },
        },
      },
    });

    const sales = await this.flashSales.activeMap(
      cart.items.map((it) => it.productId),
    );
    const items = cart.items.map((it) => {
      const resolved = resolvePrice(
        it.product.prices,
        userTier,
        sales.get(it.productId) ?? null,
      );
      const lineTotal = Number(it.priceSnapshot) * it.quantity;
      return {
        id: it.id,
        productId: it.productId,
        name: it.product.name,
        slug: it.product.slug,
        image: it.product.images[0]?.url ?? null,
        unit: it.product.unit ? { code: it.product.unit.code, name: it.product.unit.name } : null,
        quantity: it.quantity,
        priceSnapshot: Number(it.priceSnapshot),
        currentPrice: resolved.finalPrice,
        originalPrice: resolved.originalPrice,
        lineTotal,
      };
    });

    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
    return {
      id: cart.id,
      items,
      subtotal,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
    };
  }
}
