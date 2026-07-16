// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { RhChainPortableCard } from '../src/web/rhChainPortableCard';

describe('RH Chain portable card', () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
  });

  it('keeps the portable artifact to a finding, caveat, timestamp, reference, and desk link', async () => {
    container = document.createElement('div');
    document.body.append(container);
    await act(async () => {
      root = createRoot(container!);
      root.render(<RhChainPortableCard type="4663 Signal Card" label="ROUTE" finding="Receipt-backed signal memory is active." caveat="Context is not a safety determination." timestamp="2026-07-16 00:00 UTC" reference="rh_daily_004" deskHref="/rh-chain-signal-desk/4663-index" />);
    });
    expect(container.textContent).toContain('Finding');
    expect(container.textContent).toContain('Risk caveat');
    expect(container.textContent).toContain('2026-07-16 00:00 UTC');
    expect(container.textContent).toContain('rh_daily_004');
    expect(container.querySelector('a[href="/rh-chain-signal-desk/4663-index"]')?.textContent).toContain('Open desk');
  });
});
