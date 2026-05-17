type LegacyMappingStatus = 'verified_pay_cli_success';
export type MappingStatus = 'verified' | 'candidate' | 'catalog_only';
export type ExecutionEvidenceStatus = 'proven' | 'unproven' | 'unknown';

export type ProviderEndpointMappingRecord = {
  providerId: string;
  providerAliases?: string[];
  endpoint: string;
  endpointAliases?: string[];
  endpointId?: string;
  status: LegacyMappingStatus;
  verifiedAt?: string | null;
};

export type VerifiedRouteMappingRecord = {
  provider_id: string;
  provider_name: string;
  category: string;
  benchmark_intent: string;
  endpoint_url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | null;
  request_shape_example: Record<string, unknown> | null;
  response_shape_example?: Record<string, unknown> | null;
  mapping_status: MappingStatus;
  execution_evidence_status: ExecutionEvidenceStatus;
  proof_source: string;
  proof_reference?: string;
  verified_at?: string;
  notes: string;
};

export type ProviderEndpointMatchInput = {
  providerId?: string | null;
  providerName?: string | null;
  providerSlug?: string | null;
  providerNamespace?: string | null;
  providerFqn?: string | null;
};

export type MappingSource = 'none' | 'catalog' | 'verified' | 'catalog_and_verified';

const providerEndpointMap: ProviderEndpointMappingRecord[] = [
  {
    providerId: 'merit-systems-stablecrypto-market-data',
    providerAliases: ['StableCrypto', 'stablecrypto'],
    endpoint: 'https://stablecrypto.dev/api/coingecko/price',
    endpointAliases: ['/api/coingecko/price', 'api/coingecko/price'],
    status: 'verified_pay_cli_success'
  }
];

const defaultVerifiedRouteMappingRegistry: VerifiedRouteMappingRecord[] = [
  {
    provider_id: 'merit-systems-stablecrypto-market-data',
    provider_name: 'StableCrypto',
    category: 'finance/data',
    benchmark_intent: 'get SOL price',
    endpoint_url: 'https://stablecrypto.dev/api/coingecko/price',
    method: 'POST',
    request_shape_example: { ids: ['solana'], vs_currencies: ['usd'] },
    response_shape_example: { solana: { usd: 0 } },
    mapping_status: 'verified',
    execution_evidence_status: 'proven',
    proof_source: 'pay_cli',
    proof_reference: 'stablecrypto-sol-price-post-2026-05',
    notes: 'Known successful executable mapping from Pay CLI. Catalog-estimated evidence remains separate.'
  },
  {
    provider_id: 'paysponge-coingecko',
    provider_name: 'CoinGecko Onchain DEX API',
    category: 'finance/data',
    benchmark_intent: 'token search',
    endpoint_url: 'https://pro-api.coingecko.com/api/v3/x402/onchain/search/pools?query=SOL',
    method: 'GET',
    request_shape_example: { query: 'SOL' },
    mapping_status: 'verified',
    execution_evidence_status: 'proven',
    proof_source: 'infopunks-pay-sh-agent-harness',
    proof_reference: 'live-proofs/paysponge-coingecko-token-search-paid-execution-2026-05-17.md',
    verified_at: '2026-05-17',
    notes: 'Paid execution succeeded for token-search route. One proven route exists. Need a second comparable proven route before benchmark readiness. No route winner claimed.'
  },
  {
    provider_id: 'paysponge-coingecko',
    provider_name: 'CoinGecko Onchain DEX API',
    category: 'finance/data',
    benchmark_intent: 'get SOL price',
    endpoint_url: 'https://pro-api.coingecko.com/api/v3/x402/onchain/search/pools?query=SOL',
    method: 'GET',
    request_shape_example: { query: 'SOL' },
    response_shape_example: { data: [{ attributes: { name: 'SOL / USDC', base_token_price_usd: 0, quote_token_price_usd: 0 } }] },
    mapping_status: 'verified',
    execution_evidence_status: 'proven',
    proof_source: 'infopunks-pay-sh-agent-harness',
    proof_reference: 'live-proofs/paysponge-coingecko-paid-execution-2026-05-15.md',
    verified_at: '2026-05-15',
    notes: 'Paid x402 execution succeeded. Returns SOL pool market data. Comparable benchmark intent is get SOL price, but output normalization is still required before declaring a winner.'
  }
];
let verifiedRouteMappingRegistry: VerifiedRouteMappingRecord[] = [...defaultVerifiedRouteMappingRegistry];

export function listRouteMappings() {
  return [...verifiedRouteMappingRegistry];
}

export function setRouteMappingsForTest(mappings: VerifiedRouteMappingRecord[] | null) {
  verifiedRouteMappingRegistry = mappings ? [...mappings] : [...defaultVerifiedRouteMappingRegistry];
}

export function getVerifiedMappingsForProvider(input: ProviderEndpointMatchInput): ProviderEndpointMappingRecord[] {
  const keys = providerKeys(input);
  if (!keys.length) return [];
  return providerEndpointMap.filter((record) => {
    const recordKeys = providerKeys({
      providerId: record.providerId,
      providerName: null,
      providerSlug: null,
      providerNamespace: null,
      providerFqn: null
    });
    for (const alias of record.providerAliases ?? []) recordKeys.push(normalizeProviderKey(alias));
    return recordKeys.some((key) => keys.includes(key));
  });
}

export function normalizeProviderKey(value: string | null | undefined) {
  if (!value) return '';
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function endpointPathFromUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    return normalizeEndpointPath(new URL(value).pathname);
  } catch {
    return normalizeEndpointPath(value);
  }
}

export function normalizeEndpointPath(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/g, '').toLowerCase() || '/';
}

export function latestVerifiedAt(records: ProviderEndpointMappingRecord[]) {
  const timestamps = records
    .map((record) => record.verifiedAt ?? null)
    .filter((value): value is string => Boolean(value && Number.isFinite(Date.parse(value))));
  if (!timestamps.length) return null;
  return timestamps.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

function providerKeys(input: ProviderEndpointMatchInput) {
  const raw = [
    input.providerId,
    input.providerName,
    input.providerSlug,
    input.providerNamespace,
    input.providerFqn
  ];
  return Array.from(new Set(raw.map((value) => normalizeProviderKey(value)).filter(Boolean)));
}
