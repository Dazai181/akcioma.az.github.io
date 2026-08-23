import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConflictStatus,
  CustomerTier,
  Prisma,
  SyncConflict,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MergedDataDto, ResolveConflictDto } from './dto/resolve.dto';

interface IncomingSnapshot {
  rowNumber?: number;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  categorySlug: string;
  unitCode?: string | null;
  stockQty: number;
  description?: string | null;
  prices: { tier: CustomerTier; price: number }[];
}

@Injectable()
export class ConflictsService {
  constructor(private prisma: PrismaService) {}

  async list(status?: ConflictStatus) {
    return this.prisma.syncConflict.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { job: { select: { source: true, fileName: true, startedAt: true } } },
      take: 200,
    });
  }

  async get(id: string) {
    const c = await this.prisma.syncConflict.findUnique({
      where: { id },
      include: { job: true },
    });
    if (!c) throw new NotFoundException('Çakışma bulunamadı.');
    return c;
  }

  async resolve(id: string, dto: ResolveConflictDto, adminId: string) {
    const conflict = await this.prisma.syncConflict.findUnique({ where: { id } });
    if (!conflict) throw new NotFoundException('Çakışma bulunamadı.');
    if (conflict.status !== 'UNRESOLVED') {
      throw new BadRequestException('Bu çakışma zaten çözülmüş.');
    }

    let nextStatus: ConflictStatus;

    if (dto.action === 'KEEP_EXISTING') {
      // Just mark resolved; existing record is unchanged.
      nextStatus = 'KEPT_EXISTING';
    } else if (dto.action === 'APPLY_INCOMING') {
      await this.applyIncoming(conflict);
      nextStatus = 'KEPT_INCOMING';
    } else if (dto.action === 'MERGE') {
      if (!dto.mergedData) {
        throw new BadRequestException('MERGE için mergedData gereklidir.');
      }
      await this.applyMerged(conflict, dto.mergedData);
      nextStatus = 'MERGED';
    } else {
      throw new BadRequestException('Geçersiz işlem.');
    }

    return this.prisma.syncConflict.update({
      where: { id },
      data: {
        status: nextStatus,
        resolvedAt: new Date(),
        resolvedBy: adminId,
        notes: dto.notes,
      },
    });
  }

  // ── Resolution strategies ──────────────────────────────────────────────

  private async applyIncoming(conflict: SyncConflict) {
    const incoming = conflict.incomingData as unknown as IncomingSnapshot;
    const category = await this.prisma.category.findUnique({
      where: { slug: incoming.categorySlug },
    });
    if (!category) {
      throw new BadRequestException(`Kategori bulunamadı: ${incoming.categorySlug}`);
    }

    const unitId = await this.resolveUnitId(incoming.unitCode);

    if (conflict.productId) {
      // Update the matched existing product to incoming.
      await this.replaceProduct(conflict.productId, {
        name: incoming.name,
        description: incoming.description ?? undefined,
        sku: incoming.sku ?? undefined,
        barcode: incoming.barcode ?? undefined,
        categoryId: category.id,
        unitId,
        stockQty: incoming.stockQty,
        prices: incoming.prices,
      });
    } else {
      // Ambiguous match → "apply incoming" creates a new product.
      await this.createFromIncoming(incoming, category.id, unitId);
    }
  }

  private async applyMerged(conflict: SyncConflict, merged: MergedDataDto) {
    const category = await this.prisma.category.findUnique({
      where: { slug: merged.categorySlug },
    });
    if (!category) {
      throw new BadRequestException(`Kategori bulunamadı: ${merged.categorySlug}`);
    }

    const unitId = await this.resolveUnitId(merged.unitCode ?? null);

    if (conflict.productId) {
      await this.replaceProduct(conflict.productId, {
        name: merged.name,
        description: merged.description,
        sku: merged.sku,
        barcode: merged.barcode,
        categoryId: category.id,
        unitId,
        stockQty: merged.stockQty,
        prices: merged.prices,
      });
    } else {
      await this.createFromIncoming(
        {
          name: merged.name,
          sku: merged.sku ?? null,
          barcode: merged.barcode ?? null,
          categorySlug: merged.categorySlug,
          unitCode: merged.unitCode ?? null,
          stockQty: merged.stockQty,
          description: merged.description ?? null,
          prices: merged.prices,
        },
        category.id,
        unitId,
      );
    }
  }

  private async resolveUnitId(code: string | null | undefined): Promise<string | null> {
    if (!code) return null;
    const normalized = code.trim().toLowerCase();
    if (!normalized) return null;
    const u = await this.prisma.unit.upsert({
      where: { code: normalized },
      update: {},
      create: { code: normalized, name: code.trim(), isSystem: false },
    });
    return u.id;
  }

  private async replaceProduct(
    productId: string,
    data: {
      name: string;
      description?: string;
      sku?: string;
      barcode?: string;
      categoryId: string;
      unitId: string | null;
      stockQty: number;
      prices: { tier: CustomerTier; price: number }[];
    },
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.productPrice.deleteMany({ where: { productId } });
      await tx.product.update({
        where: { id: productId },
        data: {
          name: data.name,
          description: data.description,
          sku: data.sku,
          barcode: data.barcode,
          categoryId: data.categoryId,
          unitId: data.unitId ?? undefined,
          stockQty: data.stockQty,
          lastSyncedAt: new Date(),
          prices: { create: data.prices },
        },
      });
    });
  }

  private async createFromIncoming(
    incoming: IncomingSnapshot,
    categoryId: string,
    unitId: string | null,
  ) {
    const slug = await this.uniqueSlug(incoming.name);
    await this.prisma.product.create({
      data: {
        name: incoming.name,
        slug,
        description: incoming.description ?? undefined,
        sku: incoming.sku ?? undefined,
        barcode: incoming.barcode ?? undefined,
        categoryId,
        unitId: unitId ?? undefined,
        stockQty: incoming.stockQty,
        lastSyncedAt: new Date(),
        prices: { create: incoming.prices },
      },
    });
  }

  private async uniqueSlug(name: string): Promise<string> {
    const map: Record<string, string> = {
      ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i',
      ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
    };
    const base =
      name
        .split('')
        .map((c) => map[c] ?? c)
        .join('')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 80) || 'urun';
    let slug = base;
    let n = 1;
    while (await this.prisma.product.findUnique({ where: { slug } })) {
      slug = `${base}-${++n}`;
    }
    return slug;
  }
}
