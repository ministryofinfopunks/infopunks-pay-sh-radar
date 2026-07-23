export const DEFAULT_PULSE_PUBLIC_HOST = 'pulse.infopunks.fun';
export const RADAR_PUBLIC_HOST = 'radar.infopunks.fun';
export const RADAR_RENDER_HOSTS = [
  'infopunks-pay-sh-radar.onrender.com',
  'infopunks-pay-sh-radar-web.onrender.com'
] as const;

export type RhPulseRoute =
  | { kind: 'home'; id: null; canonicalPath: '/' }
  | { kind: 'methodology'; id: null; canonicalPath: '/methodology' }
  | { kind: 'call'; id: string; canonicalPath: string }
  | { kind: 'receipt'; id: string; canonicalPath: string }
  | { kind: 'not_found'; id: null; canonicalPath: '/' };

export type RhPulseRequestResolution = {
  surface: 'radar' | 'rh-pulse';
  effectiveHost: string | null;
  publicHost: string;
  route: RhPulseRoute | null;
  explicitFallbackPath: boolean;
  isPulseHost: boolean;
};

export type RhPulseBootContext = {
  surface: 'radar' | 'rh-pulse';
  publicHost: string;
  route: RhPulseRoute | null;
};

type ResolveRhPulseRequestInput = {
  pathname: string;
  host?: string | string[] | undefined;
  forwardedHost?: string | string[] | undefined;
  isProduction: boolean;
  pulsePublicHost?: string;
};

export function normalizePublicHostname(value: string | undefined | null) {
  const candidate = value?.trim().toLowerCase();
  if (!candidate || candidate.includes(',') || candidate.includes('/') || candidate.includes('@')) return null;
  try {
    const parsed = new URL(`http://${candidate}`);
    if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) return null;
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function headerValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.length === 1 ? value[0] : null;
  return value ?? null;
}

function normalizedPathname(pathname: string) {
  const path = pathname.split('?')[0]?.split('#')[0] || '/';
  return path.startsWith('/') ? path.replace(/\/{2,}/g, '/') : '/';
}

function decodeIdentifier(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseRhPulseRoute(pathname: string, pulseHostRoute: boolean): RhPulseRoute {
  const normalized = normalizedPathname(pathname).replace(/\/+$/, '') || '/';
  const routePath = pulseHostRoute
    ? normalized
    : normalized === '/rh-pulse'
      ? '/'
      : normalized.startsWith('/rh-pulse/')
        ? normalized.slice('/rh-pulse'.length)
        : normalized;

  if (routePath === '/') return { kind: 'home', id: null, canonicalPath: '/' };
  if (routePath === '/methodology') return { kind: 'methodology', id: null, canonicalPath: '/methodology' };
  const call = routePath.match(/^\/calls\/([^/]+)$/);
  if (call) {
    const id = decodeIdentifier(call[1]);
    return { kind: 'call', id, canonicalPath: `/calls/${encodeURIComponent(id)}` };
  }
  const receipt = routePath.match(/^\/receipts\/([^/]+)$/);
  if (receipt) {
    const id = decodeIdentifier(receipt[1]);
    return { kind: 'receipt', id, canonicalPath: `/receipts/${encodeURIComponent(id)}` };
  }
  return { kind: 'not_found', id: null, canonicalPath: '/' };
}

export function resolveRhPulseRequest(input: ResolveRhPulseRequestInput): RhPulseRequestResolution {
  const pulsePublicHost = normalizePublicHostname(input.pulsePublicHost) ?? DEFAULT_PULSE_PUBLIC_HOST;
  const directHost = normalizePublicHostname(headerValue(input.host));
  const forwardedHost = normalizePublicHostname(headerValue(input.forwardedHost));
  const trustedDirectHosts = new Set([
    pulsePublicHost,
    RADAR_PUBLIC_HOST,
    ...RADAR_RENDER_HOSTS,
    ...(!input.isProduction ? ['localhost', '127.0.0.1', '::1'] : [])
  ]);
  const mayTrustForwarded = Boolean(forwardedHost && trustedDirectHosts.has(directHost ?? ''));
  const effectiveHost = mayTrustForwarded ? forwardedHost : directHost;
  const isPulseHost = effectiveHost === pulsePublicHost;
  const pathname = normalizedPathname(input.pathname);
  const explicitFallbackPath = pathname === '/rh-pulse' || pathname.startsWith('/rh-pulse/');
  const pulseSurface = isPulseHost || explicitFallbackPath;

  return {
    surface: pulseSurface ? 'rh-pulse' : 'radar',
    effectiveHost,
    publicHost: pulsePublicHost,
    route: pulseSurface ? parseRhPulseRoute(pathname, isPulseHost && !explicitFallbackPath) : null,
    explicitFallbackPath,
    isPulseHost
  };
}

export function getRhPulseClientResolution(
  location: Pick<Location, 'pathname' | 'hostname'>,
  context?: RhPulseBootContext | null
): RhPulseRequestResolution {
  if (context?.surface === 'rh-pulse') {
    return {
      surface: 'rh-pulse',
      effectiveHost: normalizePublicHostname(location.hostname),
      publicHost: normalizePublicHostname(context.publicHost) ?? DEFAULT_PULSE_PUBLIC_HOST,
      route: context.route ?? parseRhPulseRoute(location.pathname, location.hostname === context.publicHost),
      explicitFallbackPath: location.pathname === '/rh-pulse' || location.pathname.startsWith('/rh-pulse/'),
      isPulseHost: location.hostname === context.publicHost
    };
  }
  return resolveRhPulseRequest({
    pathname: location.pathname,
    host: location.hostname,
    isProduction: false,
    pulsePublicHost: context?.publicHost ?? DEFAULT_PULSE_PUBLIC_HOST
  });
}

declare global {
  interface Window {
    __RH_PULSE_CONTEXT__?: RhPulseBootContext;
  }
}
