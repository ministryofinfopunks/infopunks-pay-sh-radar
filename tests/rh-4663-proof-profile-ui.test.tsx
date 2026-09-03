// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Rh4663Page } from '../src/web/rh4663Pages';

function json(data: unknown) { return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } })); }

describe('Infopunks //4663 public proof profile UI', () => {
  let container: HTMLDivElement; let root: Root;
  beforeEach(() => { Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 }); container = document.createElement('div'); document.body.append(container); });
  afterEach(() => { act(() => root?.unmount()); container.remove(); vi.restoreAllMocks(); window.history.replaceState({}, '', '/'); });

  it('keeps the profile receipt-backed and usable at 320px', async () => {
    const wallet = '0x1111111111111111111111111111111111111111'; window.history.replaceState({}, '', `/4663/proof/${wallet}`);
    vi.spyOn(globalThis, 'fetch').mockReturnValue(json({ object_type: 'PROOF_PROFILE', profile_version: 'infopunks.rh-pulse.proof-profile.v1', wallet, display_name: '0x111111…111111', calls: 1, resolved: 0, correct: 0, incorrect: 0, unresolved: 1, accuracy: null, high_confidence_accuracy: null, high_confidence: { threshold: 75, receipt_links: [] }, category_breakdown: { MEMES: { calls: 1, resolved: 0, correct: 0, incorrect: 0, unresolved: 1, accuracy: null, sample_status: 'INSUFFICIENT_SAMPLE', receipt_links: [{ receipt_id: 'IP-CALL-1', receipt_url: '/4663/proof/IP-CALL-1', resolution_receipt_id: null, resolution_receipt_url: null }] }, STOCK_TOKENS: { calls: 0, resolved: 0, correct: 0, incorrect: 0, unresolved: 0, accuracy: null, sample_status: 'INSUFFICIENT_SAMPLE', receipt_links: [] }, RWA_DEFI: { calls: 0, resolved: 0, correct: 0, incorrect: 0, unresolved: 0, accuracy: null, sample_status: 'INSUFFICIENT_SAMPLE', receipt_links: [] }, STABLES: { calls: 0, resolved: 0, correct: 0, incorrect: 0, unresolved: 0, accuracy: null, sample_status: 'INSUFFICIENT_SAMPLE', receipt_links: [] }, NO_QUALIFIED_ROTATION: { calls: 0, resolved: 0, correct: 0, incorrect: 0, unresolved: 0, accuracy: null, sample_status: 'INSUFFICIENT_SAMPLE', receipt_links: [] } }, best_supported_category: { category: null, accuracy: null, resolved: 0, status: 'INSUFFICIENT_SAMPLE' }, genesis: null, genesis_receipt: null, recent_calls: [{ call_receipt_id: 'IP-CALL-1', call_receipt_url: '/4663/proof/IP-CALL-1', resolution_receipt_id: null, resolution_receipt_url: null, called_category: 'MEMES', confidence: 74, submitted_at: '2026-09-03T00:00:00.000Z', outcome: 'UNRESOLVED', window_id: 'rh4663:2026-09-03' }], streak: { current_correct: 0 }, methodology: { version: 'infopunks.rh-pulse.proof-profile.v1', category_min_resolved: 2 }, receipt_links: [{ receipt_id: 'IP-CALL-1', receipt_url: '/4663/proof/IP-CALL-1', resolution_receipt_id: null, resolution_receipt_url: null }] }));
    await act(async () => { root = createRoot(container); root.render(<Rh4663Page />); await Promise.resolve(); await Promise.resolve(); });
    const text = container.textContent ?? '';
    expect(text).toContain('PROOF PROFILE'); expect(text).toContain('INSUFFICIENT SAMPLE'); expect(text).toContain('UNRESOLVED'); expect(text).toContain('not a portfolio, balance, or trading history'); expect(container.querySelector('a[href="/4663/proof/IP-CALL-1"]')).not.toBeNull(); expect(container.querySelector('a[href="/4663/pulse"]')).not.toBeNull();
  });
});
