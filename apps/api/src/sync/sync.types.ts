import { CustomerTier } from '@prisma/client';

export interface IncomingProduct {
  rowNumber: number;
  name: string;
  sku?: string;
  barcode?: string;
  categorySlug: string;
  unitCode?: string;
  description?: string;
  stockQty: number;
  prices: { tier: CustomerTier; price: number }[];
  rawRow: Record<string, unknown>;
}

export interface ParseResult {
  rows: IncomingProduct[];
  parseErrors: { rowNumber: number; message: string; raw: any }[];
}

/**
 * Pluggable source of products. Phase 3 ships an Excel implementation and a
 * stub ERP implementation. Drop in a real ERP client by implementing this
 * interface and registering it in `sync.module.ts`.
 */
export interface SyncProductSource {
  readonly sourceLabel: 'ERP_API' | 'EXCEL_UPLOAD';
  fetchAll(): Promise<ParseResult>;
}
