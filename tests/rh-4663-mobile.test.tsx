// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Rh4663Page } from '../src/web/rh4663Pages';

function json(data: unknown) { return Promise.resolve(new Response(JSON.stringify({ data }), { status: 200, headers: { 'content-type': 'application/json' } })); }

describe('Infopunks //4663 mobile surface', () => {
  let container: HTMLDivElement; let root: Root;
  beforeEach(() => { Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 }); container = document.createElement('div'); document.body.append(container); });
  afterEach(() => { act(() => root?.unmount()); container.remove(); vi.restoreAllMocks(); delete (window as Window & { ethereum?: unknown }).ethereum; window.history.replaceState({}, '', '/'); });

  it('renders the required mobile-first homepage hierarchy and all five destinations before data is required', async () => {
    window.history.replaceState({}, '', '/4663'); vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    await act(async () => { root = createRoot(container); root.render(<Rh4663Page />); });
    const text = container.textContent ?? '';
    expect(text).toContain('INFOPUNKS//4663'); expect(text).toContain('WE WATCHTHE FLOW.');
    for (const label of ['Current chain rotation', 'RH Pulse', 'Today on 4663', 'Signal Hunt', 'Genesis provenance']) expect(text).toContain(label);
    expect(Array.from(container.querySelectorAll('.i4663-nav a')).map((node) => node.getAttribute('href'))).toEqual(['/4663', '/4663/pulse', '/4663/today', '/4663/signals', '/4663/receipts']);
    expect(container.querySelector('.i4663-call-block a[href="/4663/pulse"]')?.textContent).toContain('CALL THE ROTATION');
  });

  it('renders an explicit unavailable Today state without invented events', async () => {
    window.history.replaceState({}, '', '/4663/today');
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ edition_id: 'today_4663_20260813_v1', date: '2026-08-13', generated_at: '2026-08-13T12:00:00.000Z', top_events: [], category_flows: [], key_signal: 'Current reviewed intelligence is unavailable.', rh_pulse_consensus: null, evidence_references: [], confidence: 0, source_timestamps: [], provider_state: 'unavailable', storage_status: 'memory', archive_path: '/v1/4663/today/2026-08-13', data_notice: 'Provider state: unavailable. No missing live observation has been fabricated.' }));
    await act(async () => { root = createRoot(container); root.render(<Rh4663Page />); await Promise.resolve(); await Promise.resolve(); });
    expect(container.textContent).toContain('SOURCE STATEUNAVAILABLE');
    expect(container.textContent).toContain('No live data has been inferred.');
    expect(container.textContent).toContain('No normalized public events were recorded');
  });

  it('labels submitted items as Signal Cards rather than receipts', async () => {
    window.history.replaceState({}, '', '/4663/signals');
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ signals: [{ signal_id: 'sig-1', representation_kind: 'SIGNAL_CARD', title: 'Wallet routing signal', category: 'wallet', thesis: 'Observed route context deserves review.', lifecycle_state: 'submitted', original_submitter: '@scout', submitted_at: '2026-08-13T12:00:00.000Z', updated_at: '2026-08-13T12:00:00.000Z', evidence: [], attribution_immutable: true, guarantee_notice: 'Signal Card is editorial intelligence, not an Evidence Receipt or Protocol Receipt.', lifecycle_history: [] }] }));
    await act(async () => { root = createRoot(container); root.render(<Rh4663Page />); await Promise.resolve(); await Promise.resolve(); });
    expect(container.textContent).toContain('SIGNAL CARD / EDITORIAL INTELLIGENCE');
    expect(container.textContent).not.toContain('PROTOCOL RECEIPT / CALL');
  });

  it('keeps Pulse primary while adding a compact fail-closed live-signals band', async () => {
    window.history.replaceState({}, '', '/4663');
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ identity: 'INFOPUNKS // 4663', thesis: 'WE WATCH THE FLOW.', rotation_snapshot: { top_signal: { ticker: 'RH', name: 'RH', signal_score: 70 }, highest_volume: { ticker: 'RH' }, highest_risk: { ticker: '—' }, last_updated: '2026-08-14T15:42:00.000Z', source_status: 'fresh' }, pulse: { window: { window_id: 'rh4663:2026-08-14', opens_at: '2026-08-14T00:00:00.000Z', closes_at: '2026-08-15T00:00:00.000Z' }, consensus: { total_calls: 0 }, options: [] }, today: { key_signal: 'Persisted intelligence.' }, live_signals: { count: 0, signals: [] }, signal_hunt: { count: 0, signals: [] }, genesis: { recorded: 0, remaining: 4663, progress: 0 } }));
    await act(async () => { root = createRoot(container); root.render(<Rh4663Page />); await Promise.resolve(); await Promise.resolve(); });
    const call = container.querySelector('.i4663-call-block'); const live = container.querySelector('.i4663-live-signals'); expect(call).not.toBeNull(); expect(live).not.toBeNull(); expect(call!.compareDocumentPosition(live!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy(); expect(live?.textContent).toContain('Automated publication is gated');
  });

  it('renders published Signals, public-safe watching, and immutable archive semantics on mobile', async () => {
    window.history.replaceState({}, '', '/4663/signals'); const published = { signal_id: 'SIGNAL-4663-0084', candidate_id: 'cand-1', representation_kind: 'SIGNAL_CARD', immutable: true, event_ids: ['event-1'], category: 'STOCK_TOKENS', signal_type: 'VOLUME_SPIKE', subjects: [{ subject_type: 'token_contract', subject_id: '0x1', label: 'NVDA' }], headline: 'NVDA VOLUME +184%', summary: 'Persisted onchain volume evidence changed.', significance_score: 87, significance_components: {}, anomaly_score: 31, anomaly_basis: 'baseline', evidence: [], source_count: 2, heuristic_version: 'heuristic-v1', detected_at: '2026-08-14T15:40:00.000Z', published_at: '2026-08-14T15:42:00.000Z', publication_hash: `sha256:${'a'.repeat(64)}`, proof_url: '/4663/signals/SIGNAL-4663-0084', share: { landscape: '/landscape', square: '/square', portrait: '/portrait' }, distribution_state: 'not_queued', finder_attribution: null, semantics: 'Signal Card is a presentation object, not an Evidence Receipt or Protocol Receipt.' };
    const watch = { signal_id: 'watch-1', representation_kind: 'SIGNAL_CARD', title: 'Culture wallets moving', category: 'nft_culture', thesis: 'Source-linked activity is being watched.', lifecycle_state: 'watching', original_submitter: '@finder', submitted_at: '2026-08-14T15:00:00.000Z', updated_at: '2026-08-14T15:00:00.000Z', evidence: [], attribution_immutable: true, guarantee_notice: 'Signal Card is editorial intelligence, not an Evidence Receipt or Protocol Receipt.', lifecycle_history: [] };
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ signals: [published], watching: [watch], signal_hunt: [watch] }));
    await act(async () => { root = createRoot(container); root.render(<Rh4663Page />); await Promise.resolve(); await Promise.resolve(); }); const text = container.textContent ?? '';
    expect(text).toContain('SIGNALS // 4663'); expect(text).toContain('LIVE1 PUBLISHED'); expect(text).toContain('NVDA VOLUME +184%'); expect(text).toContain('WATCHINGPUBLIC-SAFE / UNPUBLISHED'); expect(text).toContain('FIRST SUBMITTED BY / @finder'); expect(text).toContain('ARCHIVEIMMUTABLE PUBLIC MEMORY'); expect(container.querySelector('a[href="/4663/signals/SIGNAL-4663-0084"]')).not.toBeNull();
  });

  it('renders one evidence-deep Signal proof page with readable machine metadata and share formats', async () => {
    window.history.replaceState({}, '', '/4663/signals/SIGNAL-4663-0084');
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => json({ signal_id: 'SIGNAL-4663-0084', candidate_id: 'cand-1', representation_kind: 'SIGNAL_CARD', immutable: true, event_ids: ['event-1'], category: 'STOCK_TOKENS', signal_type: 'VOLUME_SPIKE', subjects: [{ subject_type: 'token_contract', subject_id: '0x1', label: 'NVDA' }], headline: 'NVDA VOLUME +184%', summary: 'Persisted onchain volume is now 284,000 USD.', significance_score: 87, significance_components: {}, anomaly_score: 31, anomaly_basis: 'z score', evidence: [{ reference_id: 'evidence-1', reference_type: 'provider_observation', label: 'volume', href: 'https://example.com/evidence', observed_at: '2026-08-14T15:40:00.000Z', source_status: 'fresh', source: 'dexscreener', metric: 'volume_24h_usd', previous_value: 100000, current_value: 284000, confidence: 90 }], source_count: 2, heuristic_version: 'heuristic-v1', detected_at: '2026-08-14T15:40:00.000Z', published_at: '2026-08-14T15:42:00.000Z', publication_hash: `sha256:${'a'.repeat(64)}`, proof_url: '/4663/signals/SIGNAL-4663-0084', share: { landscape: '/landscape', square: '/square', portrait: '/portrait' }, distribution_state: 'not_queued', finder_attribution: { submitted_by: '@finder', submitted_at: '2026-08-14T14:00:00.000Z' }, semantics: 'Signal Card is a presentation object, not an Evidence Receipt or Protocol Receipt.', correction_state: 'ORIGINAL', corrections: [] }));
    await act(async () => { root = createRoot(container); root.render(<Rh4663Page />); await Promise.resolve(); await Promise.resolve(); }); const text = container.textContent ?? '';
    expect(text).toContain('SIGNAL PROOF'); expect(text).toContain('SIGNIFICANCE87'); expect(text).toContain('ANOMALY31'); expect(text).toContain('HEURISTICheuristic-v1'); expect(text).toContain('FIRST SUBMITTED BY@finder'); expect(text).toContain('100,000 → 284,000 · 90 CONF'); expect(text).toContain('ORIGINAL PUBLICATION / IMMUTABLE'); for (const href of ['/landscape', '/square', '/portrait']) expect(container.querySelector(`a[href="${href}"]`)).not.toBeNull();
  });

  it('puts a resolved consequence, proof, share, record, and next call first for returning wallets', async () => {
    window.history.replaceState({}, '', '/4663/pulse'); const wallet = '0x1111111111111111111111111111111111111111'; Object.defineProperty(window, 'ethereum', { configurable: true, value: { request: vi.fn().mockResolvedValue([wallet]) } });
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => { const url = String(input); if (url.includes('/reputation/')) return json({ wallet, calls: 10, resolved_calls: 10, correct_calls: 7, accuracy: .7, current_streak: 3, genesis_position: 317, evidence: [{ window_id: 'rh4663:2026-08-12', call_receipt_id: 'call_prior', resolution_receipt_id: 'IP-RES-ABC', called_category: 'STOCK_TOKENS', resolved_category: 'STOCK_TOKENS', outcome: 'CORRECT', confidence: 78, genesis_ordinal: 317 }] }); return json({ window: { window_id: 'rh4663:2026-08-13', opens_at: '2026-08-13T00:00:00.000Z', closes_at: '2026-08-14T00:00:00.000Z' }, consensus: { total_calls: 2, leading_rotation: 'STOCK_TOKENS', confidence_average: 78, state: 'available' }, options: [] }); });
    await act(async () => { root = createRoot(container); root.render(<Rh4663Page />); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    const text = container.textContent ?? ''; expect(text).toContain('RESOLVED'); expect(text).toContain('CORRECT ✓'); expect(text).toContain('7 / 10'); expect(text).toContain('70.0%'); expect(text).toContain('CURRENT STREAK3'); expect(text).toContain('GENESIS#0317'); expect(text).toContain('SHARE RESULT'); expect(container.querySelector('.i4663-next-call')?.textContent).toContain('CALL TODAY'); expect(container.querySelector('a[href="/4663/proof/call_prior"]')).not.toBeNull();
  });

  it('renders an incorrect non-Genesis result as a shareable miss without inventing provenance', async () => {
    window.history.replaceState({}, '', '/4663/pulse'); const wallet = '0x2222222222222222222222222222222222222222'; Object.defineProperty(window, 'ethereum', { configurable: true, value: { request: vi.fn().mockResolvedValue([wallet]) } });
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => { const url = String(input); if (url.includes('/reputation/')) return json({ wallet, calls: 3, resolved_calls: 2, correct_calls: 1, accuracy: .5, current_streak: 0, genesis_position: null, evidence: [{ window_id: 'rh4663:2026-08-12', call_receipt_id: 'call_missed', resolution_receipt_id: 'IP-RES-MISS', called_category: 'MEMES', resolved_category: 'STOCK_TOKENS', outcome: 'INCORRECT', confidence: 62, genesis_ordinal: null }] }); return json({ window: { window_id: 'rh4663:2026-08-13', opens_at: '2026-08-13T00:00:00.000Z', closes_at: '2026-08-14T00:00:00.000Z' }, consensus: { total_calls: 2, leading_rotation: 'STOCK_TOKENS', confidence_average: 70, state: 'available' }, options: [] }); });
    await act(async () => { root = createRoot(container); root.render(<Rh4663Page />); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    const text = container.textContent ?? ''; expect(text).toContain('YOUR CALLMEMES'); expect(text).toContain('ACTUALSTOCK TOKENS'); expect(text).toContain('MISSED'); expect(text).toContain('SHARE RESULT'); expect(text).not.toContain('GENESIS#'); expect(container.querySelector('a[href="/4663/proof/call_missed"]')).not.toBeNull();
  });

  it('renders an unresolved call without scoring it', async () => {
    window.history.replaceState({}, '', '/4663/pulse'); const wallet = '0x1111111111111111111111111111111111111111'; Object.defineProperty(window, 'ethereum', { configurable: true, value: { request: vi.fn().mockResolvedValue([wallet]) } });
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => String(input).includes('/reputation/') ? json({ wallet, calls: 1, resolved_calls: 0, correct_calls: 0, accuracy: null, current_streak: 0, genesis_position: null, evidence: [{ window_id: 'rh4663:2026-08-13', call_receipt_id: 'call_open', resolution_receipt_id: null, called_category: 'MEMES', resolved_category: null, outcome: 'UNRESOLVED', confidence: 66, genesis_ordinal: null }] }) : json({ window: { window_id: 'rh4663:2026-08-13', opens_at: '2026-08-13T00:00:00.000Z', closes_at: '2026-08-14T00:00:00.000Z' }, consensus: { total_calls: 1, leading_rotation: 'MEMES', confidence_average: 66, state: 'available' }, options: [] }));
    await act(async () => { root = createRoot(container); root.render(<Rh4663Page />); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(container.textContent).toContain('STATUSOBSERVATION WINDOW'); expect(container.textContent).not.toContain('CORRECT ✓'); expect(container.textContent).not.toContain('MISSED');
  });
});
