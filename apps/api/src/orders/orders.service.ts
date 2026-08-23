import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FlashSalesService } from '../flash-sales/flash-sales.service';
import { resolvePrice } from '../products/pricing.util';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateOrderStatusDto } from './dto/admin-update-order.dto';

const SHIPPING_FEE_FLAT = 0;

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private flashSales: FlashSalesService,
  ) {}

  async checkout(userId: string, dto: CheckoutDto) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                prices: { select: { tier: true, price: true } },
              },
            },
          },
        },
        user: { select: { customerTier: true } },
      },
    });
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Sepetiniz boş.');
    }

    // Re-validate stock at checkout time.
    for (const item of cart.items) {
      if (item.quantity > item.product.stockQty) {
        throw new ConflictException(
          `Yetersiz stok: ${item.product.name} (${item.product.stockQty} adet kaldı).`,
        );
      }
    }

    const tier = cart.user?.customerTier ?? 'STANDARD';
    const sales = await this.flashSales.activeMap(
      cart.items.map((i) => i.productId),
    );

    let subtotal = 0;
    const orderItemsData = cart.items.map((item) => {
      const resolved = resolvePrice(
        item.product.prices,
        tier,
        sales.get(item.productId) ?? null,
      );
      const line = resolved.finalPrice * item.quantity;
      subtotal += line;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: resolved.finalPrice,
      };
    });

    const shippingFee = SHIPPING_FEE_FLAT;
    const total = subtotal + shippingFee;
    const code = await this.generateOrderCode();

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          code,
          userId,
          status: 'PENDING',
          subtotal,
          shippingFee,
          total,
          contactPhone: dto.contactPhone,
          shippingAddress: dto.shippingAddress as unknown as Prisma.InputJsonValue,
          notes: dto.notes,
          items: { create: orderItemsData },
          events: {
            create: {
              status: 'PENDING',
              note: 'Sipariş oluşturuldu.',
            },
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  unit: { select: { code: true, name: true } },
                  images: {
                    where: { isPrimary: true },
                    take: 1,
                    select: { url: true },
                  },
                },
              },
            },
          },
          events: { orderBy: { createdAt: 'asc' } },
        },
      });

      // Decrement stock atomically.
      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQty: { decrement: item.quantity } },
        });
      }

      // Empty the cart.
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return created;
    });

    return this.shapeOrder(order);
  }

  async listForUser(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                images: {
                  where: { isPrimary: true },
                  take: 1,
                  select: { url: true },
                },
              },
            },
          },
        },
      },
    });
    return orders.map((o) => ({
      id: o.id,
      code: o.code,
      status: o.status,
      total: Number(o.total),
      itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
      previewImage: o.items[0]?.product.images[0]?.url ?? null,
      previewName: o.items[0]?.product.name ?? '',
      createdAt: o.createdAt,
    }));
  }

  async getForUser(userId: string, idOrCode: string) {
    const order = await this.prisma.order.findFirst({
      where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
      include: this.detailInclude(),
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı.');
    if (order.userId !== userId) throw new ForbiddenException();
    return this.shapeOrder(order);
  }

  async adminList(params: {
    status?: OrderStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 25;
    const where: Prisma.OrderWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.search) {
      const s = params.search;
      where.OR = [
        { code: { contains: s, mode: 'insensitive' } },
        { user: { mobile: { contains: s } } },
        { user: { firstName: { contains: s, mode: 'insensitive' } } },
        { user: { lastName: { contains: s, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, mobile: true } },
          items: { select: { quantity: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items: items.map((o) => ({
        id: o.id,
        code: o.code,
        status: o.status,
        total: Number(o.total),
        itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
        customer: {
          name: `${o.user.firstName} ${o.user.lastName}`,
          mobile: o.user.mobile,
        },
        createdAt: o.createdAt,
        trackingNumber: o.trackingNumber,
      })),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  async adminGet(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.detailInclude(true),
    });
    if (!order) throw new NotFoundException('Sipariş bulunamadı.');
    return this.shapeOrder(order, true);
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const existing = await this.prisma.order.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Sipariş bulunamadı.');

    return this.prisma.$transaction(async (tx) => {
      // If cancelling a non-cancelled order, restock items.
      if (dto.status === 'CANCELLED' && existing.status !== 'CANCELLED') {
        const items = await tx.orderItem.findMany({ where: { orderId: id } });
        for (const it of items) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stockQty: { increment: it.quantity } },
          });
        }
      }

      const updated = await tx.order.update({
        where: { id },
        data: {
          status: dto.status,
          trackingNumber: dto.trackingNumber ?? undefined,
          carrier: dto.carrier ?? undefined,
          events: {
            create: { status: dto.status, note: dto.note },
          },
        },
        include: this.detailInclude(true),
      });
      return this.shapeOrder(updated, true);
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private detailInclude(withUser = false) {
    return {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              unit: { select: { code: true, name: true } },
              images: {
                where: { isPrimary: true },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      },
      events: { orderBy: { createdAt: 'asc' as const } },
      ...(withUser
        ? {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                mobile: true,
                customerTier: true,
              },
            },
          }
        : {}),
    } as const;
  }

  private shapeOrder(order: any, includeCustomer = false) {
    return {
      id: order.id,
      code: order.code,
      status: order.status,
      subtotal: Number(order.subtotal),
      shippingFee: Number(order.shippingFee),
      total: Number(order.total),
      contactPhone: order.contactPhone,
      shippingAddress: order.shippingAddress,
      notes: order.notes,
      trackingNumber: order.trackingNumber,
      carrier: order.carrier,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map((it: any) => ({
        id: it.id,
        productId: it.productId,
        name: it.product.name,
        slug: it.product.slug,
        image: it.product.images?.[0]?.url ?? null,
        unit: it.product.unit
          ? { code: it.product.unit.code, name: it.product.unit.name }
          : null,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        lineTotal: Number(it.unitPrice) * it.quantity,
      })),
      events: (order.events ?? []).map((e: any) => ({
        id: e.id,
        status: e.status,
        note: e.note,
        createdAt: e.createdAt,
      })),
      ...(includeCustomer && order.user
        ? {
            customer: {
              id: order.user.id,
              name: `${order.user.firstName} ${order.user.lastName}`,
              mobile: order.user.mobile,
              tier: order.user.customerTier,
            },
          }
        : {}),
    };
  }

  /**
   * Generate a short order code like AKS-7H4K2P. Collisions are essentially zero
   * with 32^6 keyspace and the unique index would surface them as 500s anyway —
   * we retry once for safety.
   */
  private async generateOrderCode(): Promise<string> {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 3; attempt++) {
      let suffix = '';
      for (let i = 0; i < 6; i++) {
        suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      const code = `AKS-${suffix}`;
      const collision = await this.prisma.order.findUnique({ where: { code } });
      if (!collision) return code;
    }
    throw new Error('Sipariş kodu oluşturulamadı, lütfen tekrar deneyin.');
  }
}
