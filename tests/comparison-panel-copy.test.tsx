// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComparisonPanel } from '../src/web/main';

describe('comparison panel route copy and spacing', () => {
  let root: Root | null = null;
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders verified and catalog-only badges with clean copy separators', async () => {
    const result = {
      generated_at: '2026-05-13T00:00:00.000Z',
      mode: 'provider' as const,
      rows: [
        {
          id: 'vendor-catalog-only',
          type: 'provider' as const,
          name: 'Catalog Only Provider',
          trust_score: null,
          signal_score: null,
          endpoint_count: 0,
          mapped_endpoint_count: 0,
          route_eligible_endpoint_count: 0,
          degradation_count: 0,
          pricing_clarity: null,
          metadata_quality: null,
          reachability: 'unknown' as const,
          last_observed: null,
          last_seen_healthy: null,
          mapping_source: 'none' as const,
          route_recommendation: 'not_recommended' as const,
          recommended_action: 'insufficient history' as const,
          rejection_reasons: []
        },
        {
          id: 'merit-systems-stablecrypto-market-data',
          type: 'provider' as const,
          name: 'StableCrypto',
          trust_score: 90,
          signal_score: 88,
          endpoint_count: 1,
          mapped_endpoint_count: 1,
          route_eligible_endpoint_count: 1,
          degradation_count: 0,
          pricing_clarity: 90,
          metadata_quality: 85,
          reachability: 'unknown' as const,
          last_observed: '2026-05-13T00:00:00.000Z',
          last_seen_healthy: null,
          last_verified_at: '2026-05-13T00:00:00.000Z',
          mapping_source: 'verified' as const,
          route_recommendation: 'route_eligible' as const,
          recommended_action: 'route normally' as const,
          rejection_reasons: []
        }
      ]
    };

    await act(async () => {
      root = createRoot(container);
      root.render(
        <ComparisonPanel
          providers={[
            { id: 'vendor-catalog-only', name: 'Catalog Only Provider' },
            { id: 'merit-systems-stablecrypto-market-data', name: 'StableCrypto' }
          ] as any}
          endpoints={[]}
          mode="provider"
          selectedIds={['vendor-catalog-only', 'merit-systems-stablecrypto-market-data']}
          onModeChange={() => undefined}
          onSelectionChange={() => undefined}
          result={result as any}
          onCompare={() => undefined}
        />
      );
    });

    const text = container.textContent ?? '';
    expect(text).toContain('VERIFIED ROUTE');
    expect(text).toContain('CATALOG ONLY');
    expect(text).toContain('Route status: Verified route');
    expect(text).toContain('Route status: Catalog only');
    expect(text).toContain('Route implication: Eligible for routing based on verified execution history.');
    expect(text).toContain('Last seen healthy: not yet verified');
    expect(text).toContain('Radar has discovered this provider, but no executable endpoint mapping has been verified yet.');
    expect(text).not.toContain('unknownrecommendation');
    expect(text).not.toContain('noneRoute implication');
    expect(text).not.toContain('Rejection reasons:');
    expect(text).toContain('Mapping source: verified');
    expect(text).toContain('Mapping source: none');
    expect(text).toContain('reachability unknown');
  });
});
