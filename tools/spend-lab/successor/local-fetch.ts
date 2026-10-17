/** Numeric IPv4 only: no DNS lookup, redirects, alternate origin or injected wallet transport. */
export function localFetch(
  origin: string,
  transport: typeof fetch = globalThis.fetch,
): typeof fetch {
  const base = new URL(origin);
  if (
    base.protocol !== 'http:' ||
    base.hostname !== '127.0.0.1' ||
    !base.port ||
    base.username ||
    base.password ||
    base.pathname !== '/' ||
    base.search ||
    base.hash
  )
    throw new Error('local_origin_required');
  return async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    );
    if (url.origin !== base.origin || url.username || url.password)
      throw new Error('remote_transport_hold');
    return transport(input, {
      ...init,
      redirect: 'error',
      signal: init?.signal ?? AbortSignal.timeout(10000),
    });
  };
}
