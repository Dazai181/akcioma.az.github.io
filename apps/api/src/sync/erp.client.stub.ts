import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParseResult, SyncProductSource } from './sync.types';

/**
 * StubErpClient — preserved original behavior (Phase 3 stub).
 *
 * This file is the ORIGINAL erp.client.ts contents, kept verbatim so the
 * Wolvox integration in erp.client.wolvox.ts can be reverted without losing
 * the previous implementation. To roll back, set `ERP_PROVIDER=stub` in
 * apps/api/.env (or simply unset it; "stub" is the default in the dispatcher).
 *
 * Required env: ERP_BASE_URL, ERP_API_KEY (read in fetchAll).
 */
@Injectable()
export class StubErpClient implements SyncProductSource {
  readonly sourceLabel = 'ERP_API' as const;

  constructor(private config: ConfigService) {}

  async fetchAll(): Promise<ParseResult> {
    const base = this.config.get<string>('ERP_BASE_URL');
    const key = this.config.get<string>('ERP_API_KEY');
    if (!base || !key) {
      throw new ServiceUnavailableException(
        'ERP entegrasyonu henüz yapılandırılmamış. ERP_BASE_URL ve ERP_API_KEY ortam değişkenlerini ayarlayınız.',
      );
    }

    // Real implementation goes here. Example:
    // const res = await fetch(`${base}/products`, { headers: { Authorization: `Bearer ${key}` } });
    // const data = await res.json();
    // return { rows: data.products.map(mapErpProductToIncoming), parseErrors: [] };

    return { rows: [], parseErrors: [] };
  }
}
