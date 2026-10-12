// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpendTerminalPage } from '../src/web/spendTerminalPage';
import { requestJudgment } from '../src/web/judgmentCheckClient';
import { EvidenceBadge, FreshnessBadge } from '../src/web/frontdoor4663';

const response = { judgment_id: 'test-assessment', decision: 'insufficient_evidence', confidence: 0, issued_at: '2026-10-07T00:00:02Z', valid_until: '2026-10-07T00:00:02Z', reasons: ['Required fresh evidence is missing.'], cited_observations: [], cost: { amount: '0', asset: 'USDC' }, payment_required: false, receipt: null,
  data: { decision: 'approved', judgment: { decision: 'ALLOW', receipt_id: 'legacy-diagnostic' } } };
let root: Root; let container: HTMLDivElement;
beforeEach(() => { container = document.createElement('div'); document.body.append(container); });
afterEach(() => { act(() => root?.unmount()); container.remove(); vi.restoreAllMocks(); });
function mount(node: React.ReactNode) { act(() => { root = createRoot(container); root.render(node); }); }
describe('canonical spend presentation and honest proof states', () => {
  it('shows abstention even when the legacy diagnostic says ALLOW', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }));
    mount(<SpendTerminalPage />);
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(container.textContent).toContain('Insufficient evidence');
    expect(container.textContent).toContain('Free assessment · no canonical receipt');
    expect(container.textContent).toContain('Execution: not authorized. Outcome: not verified.');
    expect(container.textContent).not.toContain('legacy-diagnostic'); expect(container.textContent).not.toContain('ALLOW');
    const init = fetch.mock.calls[0][1]!;
    expect(init.headers).not.toHaveProperty('PAYMENT-SIGNATURE');
    expect(init.headers).toHaveProperty('Idempotency-Key');
  });
  it('displays an unpaid quote and never automatically retries with a payment', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ...response, decision: 'test_spend_first', cost: { amount: '0.01', asset: 'USDC' }, payment_required: true }), { status: 402 }));
    mount(<SpendTerminalPage />);
    await act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(container.textContent).toContain('Quoted assessment · payment required for issuance');
    expect(container.textContent).toContain('No payment was submitted');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects a legacy-only reply and gives meaningful 429 recovery', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ data: response.data }), { status: 200 })).mockResolvedValueOnce(new Response('{}', { status: 429 }));
    const input = { agent_id: 'test', intent: 'quote', budget: 1, risk_tolerance: 'low' as const, preferred_settlement: 'stablecoin', required_confidence: 80 };
    await expect(requestJudgment(input, 'key', new AbortController().signal)).rejects.toThrow('invalid judgment');
    await expect(requestJudgment(input, 'key', new AbortController().signal)).rejects.toThrow('Wait a minute');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(['UNVERIFIED', 'DISCOVERED_UNVERIFIED', 'FRESH', 'PUBLISHED', 'AVAILABLE'])('does not label %s as verified proof', value => {
    mount(<EvidenceBadge state={value} />);
    expect(container.textContent).not.toBe('VERIFIED');
  });
  it('does not label a future timestamp LIVE', () => {
    mount(<FreshnessBadge at="2099-10-12T00:00:00Z" />);
    expect(container.textContent).toBe('—');
  });
});
