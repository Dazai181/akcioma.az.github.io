import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerTier, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async list(params: { search?: string; tier?: CustomerTier; limit?: number }) {
    const where: Prisma.UserWhereInput = {};
    if (params.tier) where.customerTier = params.tier;
    if (params.search) {
      where.OR = [
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { mobile: { contains: params.search } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 100,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobile: true,
        customerTier: true,
        isVerified: true,
        isAdmin: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    });

    return users;
  }

  async setTier(userId: string, tier: CustomerTier) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    return this.prisma.user.update({
      where: { id: userId },
      data: { customerTier: tier },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        mobile: true,
        customerTier: true,
      },
    });
  }
}
