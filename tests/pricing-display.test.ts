import { describe, expect, it } from 'vitest';
import { formatCatalogPrice } from '../src/web/pricingDisplay';

describe('catalog pricing display', () => {
  it('accepts normalized and explicit string price shapes', () => {
    expect(formatCatalogPrice({ min: 0.01, max: 0.05, clarity: 'range' })).toBe('$0.01 - $0.05');
    expect(formatCatalogPrice('$0.02')).toBe('$0.02');
    expect(formatCatalogPrice('free')).toBe('free');
  });
  it('keeps unknown, malformed, negative and reversed values unknown', () => {
    for (const value of [undefined, null, 0, 'unknown', '0.01 USD', { min: 0, max: 0 }, { min: -1, max: 1 }, { min: 2, max: 1 }, { min: Infinity, max: Infinity }]) {
      expect(formatCatalogPrice(value)).toBe('unknown');
    }
  });
  it('preserves explicit raw evidence as readable price only when it parses', () => {
    expect(formatCatalogPrice({ min: null, max: null, raw: '$0.03', observed_at: '2026-10-09T00:00:00Z', source: 'live' })).toBe('$0.03');
    expect(formatCatalogPrice({ min: null, max: null, raw: 'account pricing', observed_at: '2026-10-09T00:00:00Z', source: 'live' })).toBe('unknown');
  });
});
