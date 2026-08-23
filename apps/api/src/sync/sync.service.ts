import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  Product,
  ProductPrice,
  SyncSource,
  SyncStatus,
  Unit,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExcelParser } from './excel.parser';
import { ErpClient } from './erp.client';
import { IncomingProduct, ParseResult } from './sync.types';

type ProductWithPrices = Product & { prices: ProductPrice[]; unit?: Unit | null };

@Injectable()
export class SyncService {
  constructor(
    private prisma: PrismaService,
    private excel: ExcelParser,
    private erp: ErpClient,
  ) {}

  // ── Public job triggers ────────────────────────────────────────────────

  async triggerExcel(buffer: Buffer, fileName: string, adminId: string) {
    const job = await this.prisma.syncJob.create({
      data: {
        source: 'EXCEL_UPLOAD',
        status: 'PENDING',
        fileName,
        triggeredBy: adminId,
      },
    });
    // Fire-and-forget — admin polls /admin/sync/jobs/:id for progress.
    setImmediate(() => {
      void this.runJob(job.id, () => Promise.resolve(this.excel.parseBuffer(buffer)));
    });
    return job;
  }

  async triggerErp(adminId: string) {
    const job = await this.prisma.syncJob.create({
      data: { source: 'ERP_API', status: 'PENDING', triggeredBy: adminId },
    });
    setImmediate(() => {
      void this.runJob(job.id, () => this.erp.fetchAll());
    });
    return job;
  }

  // ── Job listing ────────────────────────────────────────────────────────

  async listJobs(limit = 20) {
    return this.prisma.syncJob.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: { _count: { select: { conflicts: true } } },
    });
  }

  async getJob(id: string) {
    const job = await this.prisma.syncJob.findUnique({
      where: { id },
      include: { _count: { select: { conflicts: true } } },
    });
    if (!job) throw new NotFoundException('Sync işi bulunamadı.');
    return job;
  }

  // ── Job runner ─────────────────────────────────────────────────────────

  private async runJob(jobId: string, fetcher: () => Promise<ParseResult>) {
    await this.prisma.syncJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING' },
    });

    let parsed: ParseResult;
    try {
      parsed = await fetcher();
    } catch (err: any) {
      await this.finalizeJob(jobId, 'FAILED', {
        totalRows: 0,
        successRows: 0,
        failedRows: 0,
        errorLog: { fatal: err?.message ?? String(err) },
      });
      return;
    }

    const job = await this.prisma.syncJob.findUniqueOrThrow({ where: { id: jobId } });
    let success = 0;
    let failed = parsed.parseErrors.length;
    const rowErrors: any[] = [...parsed.parseErrors];

    for (const row of parsed.rows) {
      try {
        const outcome = await this.applyIncomingRow(row, job.source, jobId);
        if (outcome === 'success') success++;
        else if (outcome === 'conflict') failed++; // counted under conflicts, surfaced separately
      } catch (err: any) {
        failed++;
        rowErrors.push({
          rowNumber: row.rowNumber,
          message: err?.message ?? String(err),
          raw: row.rawRow,
        });
      }
    }

    await this.finalizeJob(jobId, 'COMPLETED', {
      totalRows: parsed.rows.length + parsed.parseErrors.length,
      successRows: success,
      failedRows: failed,
      errorLog: rowErrors.length ? rowErrors : undefined,
    });
  }

  private async finalizeJob(
    id: string,
    status: SyncStatus,
    data: {
      totalRows: number;
      successRows: number;
      failedRows: number;
      errorLog?: any;
    },
  ) {
    await this.prisma.syncJob.update({
      where: { id },
      data: {
        status,
        totalRows: data.totalRows,
        successRows: data.successRows,
        failedRows: data.failedRows,
        errorLog: data.errorLog as Prisma.InputJsonValue | undefined,
        completedAt: new Date(),
      },
    });
  }

  // ── Core: conflict-aware upsert ────────────────────────────────────────

  private async applyIncomingRow(
    row: IncomingProduct,
    source: SyncSource,
    jobId: string,
  ): Promise<'success' | 'conflict' | 'created'> {
    const category = await this.prisma.category.findUnique({
      where: { slug: row.categorySlug },
    });
    if (!category) {
      throw new Error(`Kategori bulunamadı: ${row.categorySlug}`);
    }

    const unitId = row.unitCode ? (await this.resolveUnit(row.unitCode)).id : null;

    const matches = await this.findMatches(row);

    // Case 0: no match → safe to create
    if (matches.length === 0) {
      await this.createProduct(row, category.id, unitId, source);
      return 'created';
    }

    // Case 2: ambiguous → always a conflict
    if (matches.length > 1) {
      await this.recordConflict(jobId, null, 'ambiguous', matches, row);
      return 'conflict';
    }

    // Case 1: single match
    const existing = matches[0];
    const matchedBy = this.matchKey(existing, row);
    const change = this.classifyChange(existing, row, category.id, unitId);

    if (change === 'identical') {
      // Touch the sync metadata only.
      await this.prisma.product.update({
        where: { id: existing.id },
        data: { lastSyncedAt: new Date(), lastSyncSource: source },
      });
      return 'success';
    }

    if (change === 'safe') {
      // Stock-only or description-only changes auto-apply.
      await this.prisma.product.update({
        where: { id: existing.id },
        data: {
          stockQty: row.stockQty,
          description: row.description ?? existing.description,
          lastSyncedAt: new Date(),
          lastSyncSource: source,
        },
      });
      return 'success';
    }

    // Material change → conflict, do NOT overwrite.
    await this.recordConflict(jobId, existing.id, matchedBy, [existing], row);
    return 'conflict';
  }

  /** Look up unit by code; auto-create if unknown. Lower-cased + trimmed. */
  private async resolveUnit(code: string): Promise<Unit> {
    const normalized = code.trim().toLowerCase();
    return this.prisma.unit.upsert({
      where: { code: normalized },
      update: {},
      create: { code: normalized, name: code.trim(), isSystem: false },
    });
  }

  private async findMatches(row: IncomingProduct): Promise<ProductWithPrices[]> {
    if (row.barcode) {
      const m = await this.prisma.product.findUnique({
        where: { barcode: row.barcode },
        include: { prices: true, unit: true },
      });
      if (m) return [m];
    }
    if (row.sku) {
      const m = await this.prisma.product.findUnique({
        where: { sku: row.sku },
        include: { prices: true, unit: true },
      });
      if (m) return [m];
    }
    return this.prisma.product.findMany({
      where: { name: { equals: row.name, mode: 'insensitive' } },
      include: { prices: true, unit: true },
    });
  }

  private matchKey(existing: Product, row: IncomingProduct): string {
    if (row.barcode && existing.barcode === row.barcode) return 'barcode';
    if (row.sku && existing.sku === row.sku) return 'sku';
    return 'name';
  }

  private classifyChange(
    existing: ProductWithPrices,
    row: IncomingProduct,
    incomingCategoryId: string,
    incomingUnitId: string | null,
  ): 'identical' | 'safe' | 'material' {
    const nameChanged = existing.name.trim().toLowerCase() !== row.name.trim().toLowerCase();
    const categoryChanged = existing.categoryId !== incomingCategoryId;
    const pricesChanged = !this.pricesEqual(existing.prices, row.prices);
    // Unit change is material when incoming declares a unit AND it differs.
    const unitChanged =
      incomingUnitId != null && existing.unitId != null && existing.unitId !== incomingUnitId;

    if (nameChanged || categoryChanged || pricesChanged || unitChanged) return 'material';

    const stockChanged = existing.stockQty !== row.stockQty;
    const descChanged =
      (existing.description ?? '') !== (row.description ?? existing.description ?? '');
    if (stockChanged || descChanged) return 'safe';

    return 'identical';
  }

  private pricesEqual(
    existing: ProductPrice[],
    incoming: IncomingProduct['prices'],
  ): boolean {
    const eMap = new Map(existing.map((p) => [p.tier, Number(p.price)]));
    const iMap = new Map(incoming.map((p) => [p.tier, p.price]));
    if (eMap.size !== iMap.size) return false;
    for (const [tier, price] of iMap) {
      if (Math.abs((eMap.get(tier) ?? -1) - price) > 0.001) return false;
    }
    return true;
  }

  // ── Mutations ──────────────────────────────────────────────────────────

  private async createProduct(
    row: IncomingProduct,
    categoryId: string,
    unitId: string | null,
    source: SyncSource,
  ) {
    const slug = await this.uniqueSlug(row.name);
    await this.prisma.product.create({
      data: {
        name: row.name,
        slug,
        description: row.description,
        sku: row.sku,
        barcode: row.barcode,
        stockQty: row.stockQty,
        categoryId,
        unitId: unitId ?? undefined,
        lastSyncedAt: new Date(),
        lastSyncSource: source,
        prices: { create: row.prices },
      },
    });
  }

  private async recordConflict(
    jobId: string,
    productId: string | null,
    matchedBy: string,
    existing: ProductWithPrices[] | Product[],
    row: IncomingProduct,
  ) {
    const existingData =
      existing.length === 1 ? this.snapshot(existing[0]) : existing.map((m) => this.snapshot(m));
    await this.prisma.syncConflict.create({
      data: {
        jobId,
        productId,
        matchedBy,
        existingData: existingData as Prisma.InputJsonValue,
        incomingData: {
          rowNumber: row.rowNumber,
          name: row.name,
          sku: row.sku ?? null,
          barcode: row.barcode ?? null,
          categorySlug: row.categorySlug,
          unitCode: row.unitCode ?? null,
          stockQty: row.stockQty,
          description: row.description ?? null,
          prices: row.prices,
        } as Prisma.InputJsonValue,
        status: 'UNRESOLVED',
      },
    });
  }

  private snapshot(p: Product | ProductWithPrices) {
    const prices = (p as ProductWithPrices).prices;
    const unit = (p as ProductWithPrices).unit;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      barcode: p.barcode,
      stockQty: p.stockQty,
      categoryId: p.categoryId,
      unitCode: unit?.code ?? null,
      description: p.description,
      prices: prices?.map((pp) => ({ tier: pp.tier, price: Number(pp.price) })) ?? null,
    };
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
