import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { XMLParser } from 'fast-xml-parser';
import { CustomerTier } from '@prisma/client';
import { IncomingProduct, ParseResult, SyncProductSource } from './sync.types';

/**
 * WolvoxErpClient — Akınsoft Wolvox ERP SDK integration.
 *
 * Pulls stock + price data from a local Wolvox install via the SDK's HTTP/XML
 * endpoint and maps it to our `IncomingProduct` shape so the rest of the sync
 * pipeline (conflict detection, auto-create, etc.) works unchanged.
 *
 * Known facts encoded here (from the SDK reference doc):
 *   - URL: http://<host>:<port>/getdata.html?command=<cmd>&tpwd=<pwd>&...
 *   - The handshake does NOT support TLS — ERP_HOST must be plain http.
 *   - Default port is 3056; the firewall must permit it.
 *   - calismaYili (working year) MUST match the active fiscal year configured
 *     in Wolvox; otherwise queries return data from a closed period.
 *   - Common error strings to surface clearly:
 *       "User can not found"                 → bad dev code/password
 *       "Lisanslanan client sayısı aşılmış"  → license limit reached
 *
 * Wolvox stock-table field names vary slightly by version + customer
 * customization. The mapping below uses the most common defaults and lets you
 * override any field name via env (ERP_FIELD_*). Run a dry sync, inspect the
 * `errorLog` JSON on the SyncJob row, and adjust the env knobs if needed.
 */

interface WolvoxConfig {
  host: string;
  port: number;
  developerCode: string;
  developerPassword: string;
  companyCode: string;
  branchCode?: string;
  workingYear: string;
  command: string;
  fields: FieldMap;
  defaultCategorySlug: string;
  defaultUnitCode: string;
  timeoutMs: number;
}

interface FieldMap {
  name: string[];
  sku: string[];
  barcode: string[];
  stockQty: string[];
  unit: string[];
  category: string[];
  description: string[];
  priceStandard: string[];
  priceFavorite: string[];
  priceSpecial: string[];
}

const DEFAULT_FIELDS: FieldMap = {
  name: ['STOK_ADI', 'STOKADI', 'NAME', 'ADI'],
  sku: ['STOK_KODU', 'STOKKODU', 'SKU', 'KODU'],
  barcode: ['BARKODU', 'BARCODE', 'BARKOD'],
  stockQty: ['MIKTARI', 'STOK', 'KALAN_MIKTAR', 'MIKTAR'],
  unit: ['BIRIM', 'BIRIMI', 'UNIT'],
  category: ['GRUBU', 'STOK_GRUBU', 'GRUP', 'CATEGORY'],
  description: ['ACIKLAMA', 'ACIKLAMA1', 'DESCRIPTION'],
  priceStandard: ['SATISFIYATI1', 'PRICE1', 'STD_FIYAT'],
  priceFavorite: ['SATISFIYATI2', 'PRICE2', 'FAV_FIYAT'],
  priceSpecial: ['SATISFIYATI3', 'PRICE3', 'SPC_FIYAT'],
};

@Injectable()
export class WolvoxErpClient implements SyncProductSource {
  readonly sourceLabel = 'ERP_API' as const;

  constructor(private config: ConfigService) {}

  async fetchAll(): Promise<ParseResult> {
    const cfg = this.loadConfig();
    const url = this.buildUrl(cfg);

    let body: string;
    try {
      body = await this.fetchXml(url, cfg.timeoutMs);
    } catch (e: any) {
      throw new ServiceUnavailableException(
        `Wolvox ERP'ye bağlanılamadı (${cfg.host}:${cfg.port}). ` +
          `${e?.message ?? e}. ` +
          `Olası nedenler: 3056 portu kapalı, sunucu kapalı, IP yanlış, ya da URL https:// ile başlıyor (SDK yalnızca http destekler).`,
      );
    }

    this.surfaceKnownErrors(body);
    return this.parseStokEnvanterXml(body, cfg);
  }

  // ── config ─────────────────────────────────────────────────────────────

  private loadConfig(): WolvoxConfig {
    const rawHost = this.req('ERP_HOST');
    if (/^https:\/\//i.test(rawHost)) {
      throw new ServiceUnavailableException(
        'Wolvox SDK yalnızca düz HTTP destekler (TLS handshake yapılmaz). ERP_HOST "http://" ile veya çıplak host:port olarak tanımlanmalıdır.',
      );
    }
    return {
      host: rawHost.replace(/^https?:\/\//i, '').replace(/\/.*$/, ''),
      port: Number(this.config.get<string>('ERP_PORT') ?? '3056'),
      developerCode: this.req('ERP_DEV_CODE'),
      developerPassword: this.req('ERP_DEV_PASSWORD'),
      companyCode: this.req('ERP_COMPANY_CODE'),
      branchCode: this.config.get<string>('ERP_BRANCH_CODE') ?? undefined,
      workingYear: this.req('ERP_WORKING_YEAR'),
      command: this.config.get<string>('ERP_COMMAND') ?? 'get_stokenvanter',
      fields: this.loadFieldMap(),
      defaultCategorySlug:
        this.config.get<string>('ERP_DEFAULT_CATEGORY_SLUG') ?? 'yazi-gerecleri',
      defaultUnitCode: this.config.get<string>('ERP_DEFAULT_UNIT_CODE') ?? 'adet',
      timeoutMs: Number(this.config.get<string>('ERP_TIMEOUT_MS') ?? '60000'),
    };
  }

  private loadFieldMap(): FieldMap {
    // Each ERP_FIELD_* env may be a single name or comma-separated alternatives.
    // Whatever is provided is tried first, then the built-in defaults.
    const split = (v?: string) =>
      v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const k = (envKey: string, defaults: string[]): string[] => {
      const overrides = split(this.config.get<string>(envKey));
      return overrides.length ? [...overrides, ...defaults] : defaults;
    };
    return {
      name: k('ERP_FIELD_NAME', DEFAULT_FIELDS.name),
      sku: k('ERP_FIELD_SKU', DEFAULT_FIELDS.sku),
      barcode: k('ERP_FIELD_BARCODE', DEFAULT_FIELDS.barcode),
      stockQty: k('ERP_FIELD_STOCK_QTY', DEFAULT_FIELDS.stockQty),
      unit: k('ERP_FIELD_UNIT', DEFAULT_FIELDS.unit),
      category: k('ERP_FIELD_CATEGORY', DEFAULT_FIELDS.category),
      description: k('ERP_FIELD_DESCRIPTION', DEFAULT_FIELDS.description),
      priceStandard: k('ERP_FIELD_PRICE_STD', DEFAULT_FIELDS.priceStandard),
      priceFavorite: k('ERP_FIELD_PRICE_FAV', DEFAULT_FIELDS.priceFavorite),
      priceSpecial: k('ERP_FIELD_PRICE_SPC', DEFAULT_FIELDS.priceSpecial),
    };
  }

  private req(key: string): string {
    const v = this.config.get<string>(key);
    if (!v || !String(v).trim()) {
      throw new ServiceUnavailableException(
        `Wolvox ERP yapılandırılmamış: ${key} eksik.`,
      );
    }
    return String(v).trim();
  }

  // ── HTTP ───────────────────────────────────────────────────────────────

  private buildUrl(cfg: WolvoxConfig): string {
    const params = new URLSearchParams();
    params.set('command', cfg.command);
    params.set('tpwd', cfg.developerPassword);
    params.set('developer', cfg.developerCode);
    params.set('sirketKodu', cfg.companyCode);
    params.set('calismaYili', cfg.workingYear);
    if (cfg.branchCode) params.set('subeKodu', cfg.branchCode);
    return `http://${cfg.host}:${cfg.port}/getdata.html?${params.toString()}`;
  }

  private async fetchXml(url: string, timeoutMs: number): Promise<string> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: 'GET', signal: ac.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      return await res.text();
    } finally {
      clearTimeout(t);
    }
  }

  private surfaceKnownErrors(body: string): void {
    if (/User can not found/i.test(body)) {
      throw new ServiceUnavailableException(
        'Wolvox SDK yetkilendirme reddetti: "User can not found" — geliştirici kodu/parolası geçersiz.',
      );
    }
    if (/Lisanslanan client sayısı aşılmış/i.test(body)) {
      throw new ServiceUnavailableException(
        'Wolvox SDK lisans istemci sayısı aşıldı. Akınsoft çözüm ortağına başvurarak ek kullanıcı lisansı edinin.',
      );
    }
    if (/First mark the Synchronization/i.test(body)) {
      throw new ServiceUnavailableException(
        'Wolvox panelinde "Tam Entegrasyon" veya "Kısmi Senkronizasyon" modu etkinleştirilmemiş.',
      );
    }
  }

  // ── XML → IncomingProduct ──────────────────────────────────────────────

  private parseStokEnvanterXml(xml: string, cfg: WolvoxConfig): ParseResult {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: true,
      trimValues: true,
    });

    let parsed: any;
    try {
      parsed = parser.parse(xml);
    } catch (e: any) {
      return {
        rows: [],
        parseErrors: [
          { rowNumber: 0, message: `XML ayrıştırılamadı: ${e?.message ?? e}`, raw: null },
        ],
      };
    }

    const records = this.extractRecords(parsed);
    if (records.length === 0) {
      return {
        rows: [],
        parseErrors: [
          {
            rowNumber: 0,
            message:
              'Wolvox yanıtında ürün kaydı bulunamadı. Yanıt kök yapısı bilinen bir şemaya uymuyor; ERP_FIELD_* env değişkenleriyle alan adlarını özelleştirebilirsiniz.',
            raw: parsed,
          },
        ],
      };
    }

    const rows: IncomingProduct[] = [];
    const parseErrors: ParseResult['parseErrors'] = [];

    records.forEach((r, idx) => {
      const rowNumber = idx + 1;
      const mapped = this.mapRecord(r, cfg);
      if ('error' in mapped) {
        parseErrors.push({ rowNumber, message: mapped.error, raw: r });
      } else {
        rows.push({ ...mapped.product, rowNumber, rawRow: r });
      }
    });

    return { rows, parseErrors };
  }

  /** Walk a few common Wolvox XML wrappers and return the record array. */
  private extractRecords(parsed: any): any[] {
    const candidates = [
      parsed?.RESULT?.RECORDS?.RECORD,
      parsed?.RESULT?.RECORD,
      parsed?.ROWSET?.ROW,
      parsed?.ROOT?.ROW,
      parsed?.DATA?.RECORD,
      parsed?.DATAPACKET?.ROWDATA?.ROW,
    ];
    for (const c of candidates) {
      if (Array.isArray(c)) return c;
      if (c && typeof c === 'object') return [c];
    }
    return [];
  }

  private mapRecord(
    r: any,
    cfg: WolvoxConfig,
  ):
    | { product: Omit<IncomingProduct, 'rowNumber' | 'rawRow'> }
    | { error: string } {
    const name = pickAttrOrEl(r, cfg.fields.name);
    if (!name) return { error: 'Stok adı (STOK_ADI) yok.' };

    const sku = pickAttrOrEl(r, cfg.fields.sku);
    const barcode = pickAttrOrEl(r, cfg.fields.barcode);
    const description = pickAttrOrEl(r, cfg.fields.description);
    const unitRaw = pickAttrOrEl(r, cfg.fields.unit);
    const categoryRaw = pickAttrOrEl(r, cfg.fields.category);

    const stockNum = Number(pickAttrOrEl(r, cfg.fields.stockQty) ?? 0);
    if (!Number.isFinite(stockNum)) {
      return { error: `Geçersiz stok miktarı: ${pickAttrOrEl(r, cfg.fields.stockQty)}` };
    }

    const std = Number(pickAttrOrEl(r, cfg.fields.priceStandard) ?? 0);
    if (!Number.isFinite(std) || std < 0) {
      return {
        error: `Geçersiz STANDARD fiyat (alan: ${cfg.fields.priceStandard.join('/')}): ${pickAttrOrEl(
          r,
          cfg.fields.priceStandard,
        )}`,
      };
    }
    const fav = nonNegativeOrNull(pickAttrOrEl(r, cfg.fields.priceFavorite));
    const spec = nonNegativeOrNull(pickAttrOrEl(r, cfg.fields.priceSpecial));

    const prices: { tier: CustomerTier; price: number }[] = [
      { tier: 'STANDARD', price: std },
    ];
    if (fav != null) prices.push({ tier: 'FAVORITE', price: fav });
    if (spec != null) prices.push({ tier: 'SPECIAL', price: spec });

    return {
      product: {
        name: String(name).trim(),
        sku: sku ? String(sku).trim() : undefined,
        barcode: barcode ? String(barcode).trim() : undefined,
        categorySlug: categoryRaw
          ? slugify(String(categoryRaw))
          : cfg.defaultCategorySlug,
        unitCode: unitRaw
          ? String(unitRaw).trim().toLowerCase()
          : cfg.defaultUnitCode,
        description: description ? String(description).trim() : undefined,
        stockQty: Math.max(0, Math.floor(stockNum)),
        prices,
      },
    };
  }
}

// ── helpers ──────────────────────────────────────────────────────────────

function pickAttrOrEl(obj: any, keys: string[]): unknown {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== '') return obj[k];
    const attr = obj[`@_${k}`];
    if (attr != null && attr !== '') return attr;
  }
  return null;
}

function nonNegativeOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function slugify(s: string): string {
  const map: Record<string, string> = {
    ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', İ: 'i',
    ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u',
  };
  return (
    s
      .split('')
      .map((c) => map[c] ?? c)
      .join('')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'genel'
  );
}
