import { createResponseCache } from '../services/responseCache';

export const BLOCKSCOUT_RH_CHAIN = 'robinhood' as const;
export const BLOCKSCOUT_MAX_PAGE_SIZE = 50;

export type BlockscoutListParams = { pageSize?: number; nextPageParams?: Record<string, string | number | boolean | null | undefined>; type?: string };
export type BlockscoutToken = { address: string; name: string | null; symbol: string | null; decimals: number | null; tokenType: string | null; holdersCount: number | null; totalSupply: string | null; raw: Record<string, unknown> };
export type BlockscoutContract = { address: string; isVerified: boolean | null; creationStatus: string | null; raw: Record<string, unknown> };
export type BlockscoutAddress = { address: string; isContract: boolean | null; isVerified: boolean | null; creatorAddress: string | null; creationTransactionHash: string | null; raw: Record<string, unknown> };
export type BlockscoutPage<T> = { items: T[]; nextPageParams: Record<string, unknown> | null };

export type BlockscoutProviderOptions = {
  enabled: boolean;
  baseUrl?: string;
  timeoutMs?: number;
  cacheTtlSeconds?: number;
  maxPageSize?: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const asString = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const asNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
export const normalizeBlockscoutAddress = (value: string) => value.trim().toLowerCase();

/** Documented Blockscout v2 REST adapter. Explorer pages are never parsed or scraped. */
export class BlockscoutProvider {
  readonly enabled: boolean;
  readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly ttlMs: number;
  private readonly maxPageSize: number;
  private readonly fetchImpl: typeof fetch;
  private readonly cache = createResponseCache();
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(options: BlockscoutProviderOptions) {
    this.enabled = options.enabled;
    this.baseUrl = (options.baseUrl ?? 'https://robinhoodchain.blockscout.com').replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 2_500;
    this.ttlMs = (options.cacheTtlSeconds ?? 120) * 1_000;
    this.maxPageSize = Math.min(BLOCKSCOUT_MAX_PAGE_SIZE, Math.max(1, options.maxPageSize ?? BLOCKSCOUT_MAX_PAGE_SIZE));
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getToken(contract: string): Promise<BlockscoutToken | null> {
    const address = this.requireAddress(contract);
    try { return this.token(await this.request(`token:${address}`, `/api/v2/tokens/${encodeURIComponent(address)}`)); }
    catch (error) { if (isNotFound(error)) return null; throw error; }
  }

  async listTokens(params: BlockscoutListParams = {}): Promise<BlockscoutPage<BlockscoutToken>> {
    const payload = await this.request('tokens:' + JSON.stringify(params), `/api/v2/tokens${this.query(params, true)}`);
    return this.page(payload, (item) => this.token(item));
  }

  async getTokenTransfers(contract: string, params: BlockscoutListParams = {}): Promise<BlockscoutPage<Record<string, unknown>>> {
    const address = this.requireAddress(contract);
    return this.records(await this.request(`transfers:${address}:${JSON.stringify(params)}`, `/api/v2/tokens/${encodeURIComponent(address)}/transfers${this.query(params)}`));
  }

  async getTokenHolders(contract: string, params: BlockscoutListParams = {}): Promise<BlockscoutPage<Record<string, unknown>>> {
    const address = this.requireAddress(contract);
    return this.records(await this.request(`holders:${address}:${JSON.stringify(params)}`, `/api/v2/tokens/${encodeURIComponent(address)}/holders${this.query(params)}`));
  }

  async getContract(contract: string): Promise<BlockscoutContract | null> {
    const address = this.requireAddress(contract);
    try {
      const raw = await this.request(`contract:${address}`, `/api/v2/smart-contracts/${encodeURIComponent(address)}`);
      const row = isRecord(raw) ? raw : {};
      return { address, isVerified: asString(row.creation_status) === 'success' ? true : null, creationStatus: asString(row.creation_status), raw: row };
    } catch (error) { if (isNotFound(error)) return null; throw error; }
  }

  async getAddress(value: string): Promise<BlockscoutAddress | null> {
    const address = this.requireAddress(value);
    try {
      const raw = await this.request(`address:${address}`, `/api/v2/addresses/${encodeURIComponent(address)}`);
      const row = isRecord(raw) ? raw : {};
      return {
        address: normalizeBlockscoutAddress(asString(row.hash) ?? address), isContract: typeof row.is_contract === 'boolean' ? row.is_contract : null,
        isVerified: typeof row.is_verified === 'boolean' ? row.is_verified : null,
        creatorAddress: normalizeMaybeAddress(asString(row.creator_address_hash) ?? objectAddress(row.creator_address)),
        creationTransactionHash: asString(row.creation_transaction_hash), raw: row
      };
    } catch (error) { if (isNotFound(error)) return null; throw error; }
  }

  async getAddressTransactions(address: string, params: BlockscoutListParams = {}): Promise<BlockscoutPage<Record<string, unknown>>> {
    const normalized = this.requireAddress(address);
    return this.records(await this.request(`address-transactions:${normalized}:${JSON.stringify(params)}`, `/api/v2/addresses/${encodeURIComponent(normalized)}/transactions${this.query(params)}`));
  }

  async getTokenCreationContext(contract: string) {
    const address = await this.getAddress(contract);
    if (!address?.creatorAddress || !address.creationTransactionHash) return { deployerAddress: address?.creatorAddress ?? null, creationTransactionHash: address?.creationTransactionHash ?? null, reviewState: 'source_required' as const };
    return { deployerAddress: address.creatorAddress, creationTransactionHash: address.creationTransactionHash, reviewState: 'observed' as const };
  }

  private token(value: unknown): BlockscoutToken | null {
    if (!isRecord(value)) return null;
    const address = asString(value.address_hash);
    if (!address) return null;
    return { address: normalizeBlockscoutAddress(address), name: asString(value.name), symbol: asString(value.symbol), decimals: asNumber(value.decimals), tokenType: asString(value.type), holdersCount: asNumber(value.holders_count), totalSupply: asString(value.total_supply), raw: value };
  }
  private records(value: unknown): BlockscoutPage<Record<string, unknown>> {
    const row = isRecord(value) ? value : {};
    return { items: (Array.isArray(row.items) ? row.items.filter(isRecord) : []).slice(0, this.maxPageSize), nextPageParams: isRecord(row.next_page_params) ? row.next_page_params : null };
  }
  private page(value: unknown, normalize: (row: unknown) => BlockscoutToken | null): BlockscoutPage<BlockscoutToken> {
    const records = this.records(value);
    return { items: records.items.map(normalize).filter((item): item is BlockscoutToken => Boolean(item)), nextPageParams: records.nextPageParams };
  }
  private query(params: BlockscoutListParams, includeType = false) {
    const query = new URLSearchParams();
    // The public v2 API uses cursor-style next_page_params; page size is capped locally
    // because this endpoint does not document a universally supported items_count field.
    if (includeType && params.type) query.set('type', params.type);
    for (const [key, value] of Object.entries(params.nextPageParams ?? {})) if (value !== null && value !== undefined) query.set(key, String(value));
    const result = query.toString();
    return result ? `?${result}` : '';
  }
  private requireAddress(value: string) { const address = normalizeBlockscoutAddress(value); if (!/^0x[a-f0-9]{40}$/.test(address)) throw new Error('exact_contract_required'); return address; }
  private async request<T = unknown>(key: string, path: string): Promise<T> {
    if (!this.enabled) throw new Error('blockscout_disabled');
    const cached = await this.cache.getOrSet(`blockscout:robinhood:${key}`, this.ttlMs, async () => {
      const existing = this.inFlight.get(key) as Promise<T> | undefined;
      if (existing) return existing;
      const request = (async () => {
        const response = await this.fetchImpl(`${this.baseUrl}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(this.timeoutMs) });
        if (!response.ok) throw new Error(`blockscout_http_${response.status}`);
        return response.json() as Promise<T>;
      })();
      this.inFlight.set(key, request);
      try { return await request; } finally { this.inFlight.delete(key); }
    });
    return cached.value as T;
  }
}

function objectAddress(value: unknown) { return isRecord(value) ? asString(value.hash) : null; }
function normalizeMaybeAddress(value: string | null) { return value && /^0x[a-fA-F0-9]{40}$/.test(value) ? normalizeBlockscoutAddress(value) : null; }
function isNotFound(error: unknown) { return error instanceof Error && error.message === 'blockscout_http_404'; }
