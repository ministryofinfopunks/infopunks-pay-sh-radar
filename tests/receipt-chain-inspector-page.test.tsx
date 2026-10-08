// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { ReceiptChainInspector } from '../src/web/receiptChainInspector';
import { MemoryCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { appendChain } from './helpers/canonicalReceipts';
import { inspectReceiptChain } from '../src/services/receiptChainInspector';
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState({}, '', '/'); });
it('renders chain links, verification, policy, score, contributions and judgment comparison without a wallet', async () => {
  const store = new MemoryCanonicalReceiptStore(); const chain = await appendChain(store);
  const data = await inspectReceiptChain(store, chain.evaluation.evaluation_id);
  window.history.replaceState({}, '', '/receipts?evaluation=e1');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data })));
  const container = document.createElement('div'); document.body.append(container); const root = createRoot(container);
  try {
    await act(async () => root.render(<ReceiptChainInspector />));
    expect(container.textContent).toContain('Hashes and parents verified'); expect(container.textContent).toContain('Derived score: 5');
    expect(container.textContent).toContain('score-policy.v1'); expect(container.textContent).toContain('Contributing evaluations: e1');
    expect(container.textContent).toContain('First judgment'); expect(container.querySelectorAll('ol a')).toHaveLength(5);
    expect(fetcher).toHaveBeenCalledWith('/v1/receipt-spine/evaluation/e1/chain', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(container.querySelector('label')?.htmlFor).toBe(container.querySelector('input')?.id);
  } finally { act(() => root.unmount()); container.remove(); }
});
it('reports unavailable public evidence accessibly', async () => {
  window.history.replaceState({}, '', '/receipts?evaluation=absent');
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 404 }));
  const container = document.createElement('div'); const root = createRoot(container);
  try { await act(async () => root.render(<ReceiptChainInspector />)); expect(container.querySelector('[role="alert"]')?.textContent).toBe('Receipt chain unavailable'); }
  finally { act(() => root.unmount()); }
});
