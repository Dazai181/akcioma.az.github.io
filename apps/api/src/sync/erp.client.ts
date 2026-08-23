import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ParseResult, SyncProductSource } from './sync.types';
import { StubErpClient } from './erp.client.stub';
import { WolvoxErpClient } from './erp.client.wolvox';

/**
 * ErpClient — provider dispatcher.
 *
 * Picks the concrete implementation at construction time based on the
 * `ERP_PROVIDER` env var:
 *   - "stub"   → StubErpClient (preserved original behavior, default)
 *   - "wolvox" → WolvoxErpClient (Akınsoft Wolvox SDK XML over HTTP)
 *
 * Both implementations live side-by-side so reverting is just an env change.
 * To roll back to the original behavior set ERP_PROVIDER=stub (or unset it).
 */
@Injectable()
export class ErpClient implements SyncProductSource {
  readonly sourceLabel = 'ERP_API' as const;
  private readonly impl: SyncProductSource;
  readonly providerName: 'stub' | 'wolvox';

  constructor(config: ConfigService) {
    const provider = (config.get<string>('ERP_PROVIDER') ?? 'stub')
      .trim()
      .toLowerCase();
    if (provider === 'wolvox') {
      this.impl = new WolvoxErpClient(config);
      this.providerName = 'wolvox';
    } else {
      this.impl = new StubErpClient(config);
      this.providerName = 'stub';
    }
  }

  fetchAll(): Promise<ParseResult> {
    return this.impl.fetchAll();
  }
}
