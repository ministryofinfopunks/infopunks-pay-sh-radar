// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntelligentDecisionPage } from '../src/web/intelligentDecisionPage';

const hash = `sha256:${'a'.repeat(64)}`;
const view = {
  schema_version: 'infopunks.decision-view.v1', generated_at: '2026-10-07T00:00:30Z',
  subject: { type: 'provider', id: 'safe-provider', intent_hash: hash },
  judgment: { id: 'j1', decision: 'do_not_spend', confidence: 90, reasons: ['policy veto'],
    receipt_hash: hash, policy_version: 'receipt-authority.v1', issued_at: '2026-10-07T00:00:02Z',
    valid_until: '2026-10-07T01:00:00Z', assessment_charge: { required: false, amount: '0', asset: null } },
  evidence: { state: 'insufficient', observations: [], missing_observation_ids: [],
    history_commitment: { status: 'not_available_in_canonical_v1', hash: null } },
  verification: { ancestry_valid: true, issuer_signature_valid: true,
    within_validity_window: true, assessment_eligible: false, record_verified: true },
  execution: { authorized: false, authority_requires: 'infopunks.execution-authorization.v1', permitted_ui_actions: ['inspect_receipt', 'copy_view'] },
  presentation: { catalog_version: 'decision-card.v1', components: ['decision_verdict', 'evidence_inspector', 'receipt_identity'] }
};

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: view }), { status: 200 })));
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
  delete (window as Window & { __INFOPUNKS_API_BASE_URL__?: string }).__INFOPUNKS_API_BASE_URL__;
});

function input(id: string, value: string) {
  act(() => { const field = host.querySelector<HTMLInputElement>(id)!; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value); field.dispatchEvent(new Event('input', { bubbles: true })); });
}
async function inspect(id = 'j1') {
  await act(async () => root.render(<IntelligentDecisionPage id={id} />));
  input('#decision-tenant-key', 'synthetic-tenant-key');
  await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
}
it('private view does not make an anonymous request on mount', async () => {
  await act(async () => root.render(<IntelligentDecisionPage id="j1" />));
  expect(fetch).not.toHaveBeenCalled();
  expect(host.querySelector<HTMLInputElement>('#decision-tenant-key')?.type).toBe('password');
});
it('authenticates explicit inspection and shows canonical veto without execution controls', async () => {
  await inspect();
  expect(fetch).toHaveBeenCalledWith('/v1/decision-views/j1', expect.objectContaining({headers: {Accept:'application/json',Authorization:'Bearer synthetic-tenant-key'},cache:'no-store',redirect:'error'}));
  expect(host.textContent).toContain('VERIFIED VETO'); expect(host.textContent).toContain('Execution authorized');
  expect(host.querySelector('a[href="/proof/judgment/j1"]')).toBeTruthy();
  expect(host.querySelector('a[href*="/v1/receipt-spine"]')).toBeNull();
  const buttons = [...host.querySelectorAll('button')].map(el => el.textContent?.toLowerCase());
  expect(buttons).not.toContain('approve'); expect(buttons).not.toContain('execute'); expect(buttons).not.toContain('pay');
  input('#decision-tenant-key','changed'); expect(host.textContent).not.toContain('VERIFIED VETO');
});
it('rejects mismatched Judgment identity', async () => { await inspect('different'); expect(host.textContent).toContain('Decision view failed validation'); expect(host.textContent).not.toContain('VERIFIED VETO'); });
it.each([
  {...view, execution:{...view.execution, authorized:true}},
  {...view, verification:{...view.verification,assessment_eligible:true}},
  {...view, verification:{...view.verification,record_verified:false}}
])('fails closed on authority or verification mismatch', async payload => {
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({data:payload}),{status:200})));
  await inspect(); expect(host.textContent).toContain('Decision view failed validation'); expect(host.textContent).not.toContain('VERIFIED VETO');
});
it('401 moves focus to re-enabled corrective credential without echo', async () => {
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:401})));
  await inspect(); expect(document.activeElement?.id).toBe('decision-tenant-key'); expect(host.textContent).not.toContain('synthetic-tenant-key'); expect(host.textContent).toContain('This key could not authorize inspection');
});
it.each([403,404])('private denial %s is generic and leaves no prior record', async status => {
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('private-fragment',{status})));
  await inspect(); expect(host.textContent).toContain('Decision unavailable for this authenticated identity'); expect(host.textContent).not.toContain('private-fragment'); expect(host.textContent).not.toContain('safe-provider');
});
it('route identity change clears credentials and old data without refetch', async () => {
  await inspect(); vi.mocked(fetch).mockClear();
  await act(async()=>root.render(<IntelligentDecisionPage id="j2"/>));
  expect(fetch).not.toHaveBeenCalled(); expect(host.querySelector<HTMLInputElement>('#decision-tenant-key')?.value).toBe(''); expect(host.textContent).not.toContain('safe-provider');
});
