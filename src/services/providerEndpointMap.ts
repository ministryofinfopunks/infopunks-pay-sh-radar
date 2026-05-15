type MappingStatus = 'verified_pay_cli_success';

export type ProviderEndpointMappingRecord = {
  providerId: string;
  providerAliases?: string[];
  endpoint: string;
  endpointAliases?: string[];
  endpointId?: string;
  status: MappingStatus;
  verifiedAt?: string | null;
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
