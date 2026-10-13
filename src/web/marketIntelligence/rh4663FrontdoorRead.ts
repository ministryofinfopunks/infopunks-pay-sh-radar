import { useEffect, useState } from 'react';
import type { Rh4663FrontdoorState } from '../../services/rh4663FrontdoorService';
import { getApiBaseUrl, toApiUrl } from '../apiBaseUrl';
import { startRhChainMarketRevalidation } from '../rhChainMarketRevalidation';

/** Anonymous, conditional shared reads. A failed refresh never changes evidence age. */
export function useRh4663FrontdoorRead() {
  const [state, setState] = useState<{ data: Rh4663FrontdoorState | null; status: 'loading' | 'ready' | 'degraded'; message?: string }>({ data: null, status: 'loading' });
  useEffect(() => {
    let active = true, etag: string | null = null, controller: AbortController | null = null, pending = false;
    const read = async () => {
      if (!active || pending || document.hidden) return;
      pending = true; controller = new AbortController(); const timeout = window.setTimeout(() => controller?.abort(), 4_000);
      try {
        const response = await fetch(toApiUrl(getApiBaseUrl(), '/v1/4663/frontdoor'), { credentials: 'omit', cache: 'no-cache', signal: controller.signal,
          headers: { accept: 'application/json', ...(etag ? { 'if-none-match': etag } : {}) } });
        if (!active) return;
        if (response.status === 304) { setState(prior => ({ ...prior, status: 'ready', message: undefined })); return; }
        if (!response.ok) throw new Error('frontdoor_unavailable');
        const body = await response.json() as { data: Rh4663FrontdoorState };
        if (!active) return;
        etag = response.headers.get('etag'); setState({ data: body.data, status: 'ready' });
      } catch { if (active) setState(prior => ({ ...prior, status: 'degraded', message: 'Refresh unavailable. Last-known evidence keeps its original observation time.' })); }
      finally { pending = false; window.clearTimeout(timeout); }
    };
    void read(); const stop = startRhChainMarketRevalidation(read, 15_000);
    return () => { active = false; stop(); controller?.abort(); };
  }, []);
  return state;
}
