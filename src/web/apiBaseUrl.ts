type ResolveApiBaseUrlOptions = {
  envApiBaseUrl?: string;
};

export function resolveApiBaseUrl(options: ResolveApiBaseUrlOptions): string {
  const configuredBaseUrl = options.envApiBaseUrl?.trim();
  if (!configuredBaseUrl) return '';
  return configuredBaseUrl.replace(/\/+$/, '');
}

export function toApiUrl(baseUrl: string, path: string): string {
  if (!baseUrl) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl({
    envApiBaseUrl: import.meta.env.VITE_API_BASE_URL
  });
}
