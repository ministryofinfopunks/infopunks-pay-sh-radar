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

describe('read-only Intelligent Decision Card', () => {
  it('shows the canonical veto without any payment, approval or execution buttons', async () => {
    await act(async () => root.render(<IntelligentDecisionPage id="j1" />));
    expect(host.textContent).toContain('Do not spend');
    expect(host.textContent).toContain('VERIFIED VETO');
    expect(host.textContent).toContain('Execution authorized');
    expect(host.textContent).toContain('NO');
    const buttons = [...host.querySelectorAll('button')].map(el => el.textContent?.toLowerCase());
    expect(buttons).not.toContain('approve');
    expect(buttons).not.toContain('execute');
    expect(buttons).not.toContain('pay');
  });
  it('fails closed when view id does not match route id', async () => {
    await act(async () => root.render(<IntelligentDecisionPage id="different" />));
    expect(host.textContent).toContain('Decision view failed validation');
    expect(host.textContent).not.toContain('VERIFIED VETO');
  });

  it('fails closed if a modified response claims execution authority', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: {
      ...view, execution: { ...view.execution, authorized: true }
    } }), { status: 200 })));
    await act(async () => root.render(<IntelligentDecisionPage id="j1" />));
    expect(host.textContent).toContain('Decision view failed validation');
    expect(host.textContent).not.toContain('VERIFIED VETO');
  });

  it('fails closed if a modified veto response claims assessment eligibility', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: {
      ...view, verification: { ...view.verification, assessment_eligible: true }
    } }), { status: 200 })));
    await act(async () => root.render(<IntelligentDecisionPage id="j1" />));
    expect(host.textContent).toContain('Decision view failed validation');
    expect(host.textContent).not.toContain('VERIFIED VETO');
  });

  it('uses the configured API base for canonical receipt links and reports throttling', async () => {
    (window as Window & { __INFOPUNKS_API_BASE_URL__?: string }).__INFOPUNKS_API_BASE_URL__ = 'https://api.example.test';
    await act(async () => root.render(<IntelligentDecisionPage id="j1" />));
    expect(host.querySelector('a[href="https://api.example.test/v1/receipt-spine/judgment/j1"]')).toBeTruthy();

    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));
    await act(async () => root.render(<IntelligentDecisionPage id="j2" />));
    expect(host.textContent).toContain('Too many requests. Wait before trying again.');
    delete (window as Window & { __INFOPUNKS_API_BASE_URL__?: string }).__INFOPUNKS_API_BASE_URL__;
  });
});
