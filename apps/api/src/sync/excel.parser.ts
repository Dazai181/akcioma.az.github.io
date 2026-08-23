import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { CustomerTier } from '@prisma/client';
import { IncomingProduct, ParseResult } from './sync.types';

const REQUIRED = ['name', 'category_slug', 'stock_qty', 'standard_price'] as const;

/**
 * Expected columns (header row, case-insensitive, snake_case):
 *   name              required
 *   sku               optional
 *   barcode           optional
 *   category_slug     required (must match an existing category)
 *   description       optional
 *   stock_qty         required, integer >= 0
 *   unit              optional, unit code (e.g. adet, kg, gr, lt, ml). Unknown
 *                     codes are auto-created.
 *   standard_price    required, number >= 0
 *   favorite_price    optional, number >= 0
 *   special_price     optional, number >= 0
 */
@Injectable()
export class ExcelParser {
  parseBuffer(buffer: Buffer): ParseResult {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      return { rows: [], parseErrors: [{ rowNumber: 0, message: 'Excel dosyasında sayfa bulunamadı.', raw: null }] };
    }

    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: true,
    });

    const rows: IncomingProduct[] = [];
    const parseErrors: ParseResult['parseErrors'] = [];

    json.forEach((raw, idx) => {
      const rowNumber = idx + 2; // header is row 1
      const norm: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(raw)) {
        norm[k.trim().toLowerCase().replace(/\s+/g, '_')] = v;
      }

      const missing = REQUIRED.filter((f) => norm[f] == null || norm[f] === '');
      if (missing.length) {
        parseErrors.push({
          rowNumber,
          message: `Eksik zorunlu alan(lar): ${missing.join(', ')}`,
          raw: norm,
        });
        return;
      }

      const stockNum = Number(norm.stock_qty);
      const stdPrice = Number(norm.standard_price);
      if (!Number.isFinite(stockNum) || stockNum < 0) {
        parseErrors.push({ rowNumber, message: `Geçersiz stok_qty: ${norm.stock_qty}`, raw: norm });
        return;
      }
      if (!Number.isFinite(stdPrice) || stdPrice < 0) {
        parseErrors.push({ rowNumber, message: `Geçersiz standard_price: ${norm.standard_price}`, raw: norm });
        return;
      }

      const prices: IncomingProduct['prices'] = [{ tier: 'STANDARD', price: stdPrice }];
      const fav = this.optionalNumber(norm.favorite_price);
      const spec = this.optionalNumber(norm.special_price);
      if (fav != null) prices.push({ tier: 'FAVORITE' as CustomerTier, price: fav });
      if (spec != null) prices.push({ tier: 'SPECIAL' as CustomerTier, price: spec });

      rows.push({
        rowNumber,
        name: String(norm.name).trim(),
        sku: this.optionalString(norm.sku),
        barcode: this.optionalString(norm.barcode),
        categorySlug: String(norm.category_slug).trim(),
        unitCode: this.optionalString(norm.unit)?.toLowerCase(),
        description: this.optionalString(norm.description),
        stockQty: Math.floor(stockNum),
        prices,
        rawRow: norm,
      });
    });

    return { rows, parseErrors };
  }

  private optionalString(v: unknown): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length === 0 ? undefined : s;
  }

  private optionalNumber(v: unknown): number | undefined {
    if (v == null || v === '') return undefined;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  }
}
