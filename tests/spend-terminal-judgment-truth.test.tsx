// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { SpendTerminalPage } from '../src/web/preSpendBuilderPages';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

it('shows the canonical free outcome and clears it when the next request fails', async () => {
  const data = { subject: null, intent: 'buy_market_research', decision: 'use_with_caution', recommended_route: 'route_1', confidence_score: 0, risk_level: 'medium', estimated_cost: '0.25 USDC', last_successful_run: null, known_blockers: [], requires_human_approval: false, receipt_references: ['receipt_001'], safer_alternatives: [], do_not_use: [], rationale: [], judgment: { receipt_id: 'legacy_ref', decision: 'DEGRADE', outcome_status: 'NOT_VERIFIED' }, canonical_judgment: { judgment_id: 'j1', decision: 'insufficient_evidence', confidence: 0, reasons: ['Evidence missing.'], cost: { amount: '0', asset: 'USDC' }, payment_required: false, receipt: null } };
  let checks = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (String(input).includes('/v1/routes')) return new Response('{}', { status: 503 });
    checks++;
    return checks === 1 ? new Response(JSON.stringify({ data }), { status: 200 }) : new Response('{}', { status: 400 });
  });
  const node = document.createElement('div'); document.body.append(node);
  const root = createRoot(node);
  await act(async () => { root.render(<SpendTerminalPage />); });
  const form = node.querySelector('form')!;
  await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(node.textContent).toContain('Judgment: insufficient_evidence');
  expect(node.textContent).toContain('Judgment charge: 0 USDC');
  expect(node.textContent).toContain('Judgment receipt: not issued');
  expect(node.textContent).toContain('The canonical response states whether a judgment receipt was issued.');
  expect(node.textContent).not.toContain('No receipt, no trust');
  expect(node.textContent).toContain('historical evidence receipts');
  expect(node.textContent).not.toContain('canonical judgmentDEGRADE');
  await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  expect(node.textContent).toContain('/v1/pre-spend/check 400');
  expect(node.textContent).not.toContain('Judgment: insufficient_evidence');
  await act(async () => root.unmount());
});
