export const PRODUCTION_API_BASE_URL_FALLBACK = 'https://infopunks-pay-sh-radar.onrender.com';

type ResolveApiBaseUrlOptions = {
  mode: string;
  envApiBaseUrl?: string;
  locationOrigin: string;
  warn?: Pick<Console, 'warn'>;
};

export function resolveApiBaseUrl(options: ResolveApiBaseUrlOptions): string {
  const configuredBaseUrl = options.envApiBaseUrl?.trim();
  if (configuredBaseUrl) return configuredBaseUrl;

  if (options.mode === 'production') {
    options.warn?.warn(
      `[frontend-api] VITE_API_BASE_URL is missing in production; falling back to ${PRODUCTION_API_BASE_URL_FALLBACK}`
    );
    return PRODUCTION_API_BASE_URL_FALLBACK;
  }

  return options.locationOrigin;
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl({
    mode: import.meta.env.MODE,
    envApiBaseUrl: import.meta.env.VITE_API_BASE_URL,
    locationOrigin: window.location.origin,
    warn: console
  });
}
