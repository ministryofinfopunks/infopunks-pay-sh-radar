import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { BOOT_LOADING_LABELS, bootLoadingLabelForPath, currentBootLoadingLabel, initialBootShellScript, radarNetworkForPath } from '../src/web/bootContext';

describe('initial Radar boot context', () => {
  it('resolves the universal homepage, Solana landing, RH Chain, and unknown paths deterministically', () => {
    expect(radarNetworkForPath('/')).toBe('universal');
    expect(radarNetworkForPath('/solana')).toBe('solana');
    expect(radarNetworkForPath('/rh-chain-signal-desk')).toBe('robinhood-chain');
    expect(radarNetworkForPath('/rh-chain-signal-desk/meme-pulse')).toBe('robinhood-chain');
    expect(radarNetworkForPath('/rh-chain-signal-desk/clone-radar')).toBe('robinhood-chain');
    expect(radarNetworkForPath('/rh-chain-signal-desk/launchpad-observatory')).toBe('robinhood-chain');
    expect(radarNetworkForPath('/rh-chain-signal-desk/tokens/0x123')).toBe('robinhood-chain');
    expect(radarNetworkForPath('/providers')).toBe('solana');
    expect(radarNetworkForPath('/routes')).toBe('solana');
    expect(radarNetworkForPath('/receipts')).toBe('solana');
    expect(radarNetworkForPath('/benchmarks')).toBe('solana');
    expect(radarNetworkForPath('/not-a-radar-route')).toBe('universal');
  });

  it('uses the exact loading copy for each network context', () => {
    expect(bootLoadingLabelForPath('/')).toBe('INFOPUNKS RADAR // INTELLIGENCE SYSTEM BOOTING...');
    expect(bootLoadingLabelForPath('/solana')).toBe('INFOPUNKS RADAR // SOLANA INTELLIGENCE BOOTING...');
    expect(bootLoadingLabelForPath('/providers')).toBe('INFOPUNKS RADAR // SOLANA INTELLIGENCE BOOTING...');
    expect(bootLoadingLabelForPath('/rh-chain-signal-desk/clone-radar')).toBe('INFOPUNKS RADAR // RH CHAIN INTELLIGENCE BOOTING...');
    expect(Object.values(BOOT_LOADING_LABELS)).toEqual([
      'INFOPUNKS RADAR // INTELLIGENCE SYSTEM BOOTING...',
      'INFOPUNKS RADAR // SOLANA INTELLIGENCE BOOTING...',
      'INFOPUNKS RADAR // RH CHAIN INTELLIGENCE BOOTING...'
    ]);
  });

  it('applies the same context before the React entry runs', () => {
    const renderStaticBootLabel = (pathname: string) => {
      const root = { ready: false, setAttribute: (_name: string, value: string) => { root.ready = value === 'true'; } };
      const label = { textContent: '', closest: () => root };
      runInNewContext(initialBootShellScript(), {
        window: { location: { pathname } },
        document: { querySelector: () => label }
      });
      expect(root.ready).toBe(true);
      return label.textContent;
    };

    expect(renderStaticBootLabel('/')).toBe(bootLoadingLabelForPath('/'));
    expect(renderStaticBootLabel('/solana')).toBe(bootLoadingLabelForPath('/solana'));
    expect(renderStaticBootLabel('/providers')).toBe(bootLoadingLabelForPath('/providers'));
    expect(renderStaticBootLabel('/rh-chain-signal-desk/launchpad-observatory')).toBe(bootLoadingLabelForPath('/rh-chain-signal-desk/launchpad-observatory'));
    expect(renderStaticBootLabel('/not-a-radar-route')).toBe(bootLoadingLabelForPath('/not-a-radar-route'));
  });

  it('falls back safely when no browser window is available', () => {
    expect(currentBootLoadingLabel()).toBe('INFOPUNKS RADAR // INTELLIGENCE SYSTEM BOOTING...');
  });

  it('keeps the static shell route-aware, accessible, and motion-safe without legacy product copy', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

    expect(html).toContain('<!-- radar-boot-context -->');
    expect(html).toContain('data-radar-initial-boot');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('prefers-reduced-motion: reduce');
    expect(html).not.toContain('INFOPUNKS//PAY.SH');
    expect(initialBootShellScript()).toContain('window.location.pathname');
    expect(initialBootShellScript()).not.toContain('INFOPUNKS//PAY.SH');
  });
});
