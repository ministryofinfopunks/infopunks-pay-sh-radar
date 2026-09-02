// @vitest-environment jsdom
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IpxPltrPreflightLabPage } from '../src/web/ipxPltrPreflightLabPage';

describe('IPX / PLTR Preflight Lab page', () => {
  let container: HTMLDivElement | null = null; afterEach(() => { container?.remove(); container = null; vi.restoreAllMocks(); });
  it('renders the lab doctrine, explicit snapshot, three templates and mobile-safe output labels', async () => {
    container = document.createElement('div'); document.body.append(container); await act(async () => { createRoot(container!).render(<IpxPltrPreflightLabPage />); }); const text = container.textContent ?? '';
    expect(text).toContain('IPX / PLTR'); expect(text).toContain('PREFLIGHT LAB'); expect(text).toContain('Two forms of intelligence. One hypothetical market.'); expect(text).toContain('No token has been launched. No transaction is executed.'); expect(text).toContain('FROZEN PLTR STATE'); expect(text).toContain('PLTR NATIVE'); expect(text).toContain('PLTR ANCHOR'); expect(text).toContain('PLTR RESERVE ANCHOR'); expect(text).toContain('SIMULATE'); expect(container.querySelector('input[aria-label="Frozen PLTR state observation ID"]')?.getAttribute('value')).toBe('pltr-preflight-52406504-20260902074509000');
  });
});
