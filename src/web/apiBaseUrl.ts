type ResolveApiBaseUrlOptions = {
  envApiBaseUrl?: string;
  runtimeApiBaseUrl?: string | null;
  locationHost?: string;
};

const STATIC_PUBLIC_HOST = 'radar.infopunks.fun';
const RENDER_API_HOST = 'https://infopunks-pay-sh-radar.onrender.com';

export function resolveApiBaseUrl(options: ResolveApiBaseUrlOptions): string {
  const runtimeBaseUrl = options.runtimeApiBaseUrl?.trim();
  if (runtimeBaseUrl) return runtimeBaseUrl.replace(/\/+$/, '');
  const configuredBaseUrl = options.envApiBaseUrl?.trim();
  if (configuredBaseUrl) return configuredBaseUrl.replace(/\/+$/, '');
  if (options.locationHost === STATIC_PUBLIC_HOST) return RENDER_API_HOST;
  return '';
}

export function toApiUrl(baseUrl: string, path: string): string {
  if (!baseUrl) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export function getApiBaseUrl(): string {
  const runtimeApiBaseUrl = typeof window !== 'undefined'
    ? (
      (window as Window & { __INFOPUNKS_API_BASE_URL__?: string }).__INFOPUNKS_API_BASE_URL__
      ?? document.querySelector('meta[name="infopunks-api-base-url"]')?.getAttribute('content')
    )
    : undefined;
  return resolveApiBaseUrl({
    envApiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    runtimeApiBaseUrl,
    locationHost: typeof window !== 'undefined' ? window.location.host : undefined
  });
}
