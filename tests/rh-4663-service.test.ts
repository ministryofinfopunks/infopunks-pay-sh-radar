import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import {
  buildRh4663CallPayload,
  getRh4663PulseWindow,
  InMemoryRh4663Store,
  Rh4663Service,
  Rh4663ServiceError,
  serializeRh4663CallPayload
} from '../src/services/rh4663Service';

const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const fixed = new Date('2026-08-13T12:00:00.000Z');

async function signedCall(service: Rh4663Service, overrides: Record<string, unknown> = {}) {
  const base = { wallet: account.address, rotation: 'MEMES' as const, confidence: 73, ...overrides };
  const built = service.pulsePayload(base);
  const signature = await account.signMessage({ message: built.canonical_serialization });
  return service.call({ ...base, signature });
}

describe('Infopunks //4663 protocol service', () => {
  it('uses fixed half-open UTC-day windows at exact boundaries', () => {
    expect(getRh4663PulseWindow(new Date('2026-08-13T00:00:00.000Z'))).toEqual({
      window_id: 'rh4663:2026-08-13', opens_at: '2026-08-13T00:00:00.000Z', closes_at: '2026-08-14T00:00:00.000Z', closes_at_exclusive: true, semantics: 'fixed_utc_day'
    });
    expect(getRh4663PulseWindow(new Date('2026-08-13T23:59:59.999Z')).window_id).toBe('rh4663:2026-08-13');
    expect(getRh4663PulseWindow(new Date('2026-08-14T00:00:00.000Z')).window_id).toBe('rh4663:2026-08-14');
  });

  it('serializes signing payloads deterministically and normalizes address and digest case', () => {
    const input = { wallet: account.address.toLowerCase(), rotation: 'RWA_DEFI' as const, confidence: 88, evidence_digest: `0x${'AB'.repeat(32)}` };
    const first = buildRh4663CallPayload(input, fixed); const second = buildRh4663CallPayload({ ...input }, fixed);
    expect(first).toEqual(second);
    expect(first.canonical_serialization).toBe(serializeRh4663CallPayload(first.payload));
    expect(first.canonical_serialization).toContain('"version":"infopunks.rh-pulse.call.v1"');
    expect(first.payload_hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('rejects invalid confidence before a payload can be signed', () => {
    expect(() => buildRh4663CallPayload({ wallet: account.address, rotation: 'MEMES', confidence: 0 }, fixed)).toThrow();
    expect(() => buildRh4663CallPayload({ wallet: account.address, rotation: 'MEMES', confidence: 101 }, fixed)).toThrow();
    expect(() => buildRh4663CallPayload({ wallet: account.address, rotation: 'MEMES', confidence: 2.5 }, fixed)).toThrow();
  });

  it('enforces one verified wallet call per window', async () => {
    const service = new Rh4663Service(new InMemoryRh4663Store(), () => fixed);
    const first = await signedCall(service);
    expect(first).toMatchObject({ receipt_kind: 'PROTOCOL_RECEIPT', protocol_receipt_type: 'CALL', immutable: true, signature_verified: true, genesis_eligible: true, genesis_ordinal: 1 });
    await expect(signedCall(service, { rotation: 'STABLES' })).rejects.toMatchObject({ code: 'wallet_already_called_in_window', statusCode: 409 } satisfies Partial<Rh4663ServiceError>);
  });

  it('returns detached immutable receipt snapshots', async () => {
    const store = new InMemoryRh4663Store(); const service = new Rh4663Service(store, () => fixed); const created = await signedCall(service);
    const external = await store.getCall(created.receipt_id); expect(external).not.toBeNull();
    if (external) { external.confidence = 1; external.canonical_payload.confidence = 1; }
    expect(await store.getCall(created.receipt_id)).toMatchObject({ confidence: 73, canonical_payload: { confidence: 73 }, immutable: true });
  });

  it('creates one durable-style Today edition per date and exposes degraded sources without fabrication', async () => {
    let now = fixed; const store = new InMemoryRh4663Store(); const service = new Rh4663Service(store, () => now);
    const first = await service.today({ keySignal: 'No current provider observation is available.', categoryFlows: [], evidence: [], providerState: 'unavailable', confidence: 0 });
    now = new Date('2026-08-13T20:00:00.000Z');
    const second = await service.today({ keySignal: 'This later value must not overwrite the edition.', categoryFlows: [], evidence: [], providerState: 'available', confidence: 100 });
    expect(second).toEqual(first);
    expect(first).toMatchObject({ edition_id: 'today_4663_20260813_v1', provider_state: 'unavailable', confidence: 0, storage_status: 'memory' });
    expect(first.data_notice).toContain('No missing live observation has been fabricated');
    expect(await store.listToday()).toHaveLength(1);
  });

  it('preserves original signal attribution across evidence and valid lifecycle transitions', async () => {
    const store = new InMemoryRh4663Store(); const service = new Rh4663Service(store, () => fixed);
    const submitted = await service.submitSignal({ title: 'Wallet flow is concentrating', category: 'wallet', thesis: 'A source-linked wallet cluster deserves review.', submitter: '@first_scout', source_url: 'https://example.com/source' });
    const watching = await service.transitionSignal(submitted.signal_id, { state: 'watching', note: 'Reviewer opened the source trail.' }, 'reviewer-1');
    const evidenced = await service.addSignalEvidence(submitted.signal_id, { url: 'https://example.com/evidence', label: 'Wallet observation' }, 'reviewer-1');
    const confirmed = await service.transitionSignal(submitted.signal_id, { state: 'confirmed', note: 'Evidence threshold met.' }, 'reviewer-1');
    expect([watching, evidenced, confirmed].every((signal) => signal.original_submitter === '@first_scout')).toBe(true);
    expect(confirmed.lifecycle_history.map((item) => item.to)).toEqual(['submitted', 'watching', 'evidence_added', 'confirmed']);
    await expect(service.transitionSignal(submitted.signal_id, { state: 'watching', note: 'Invalid regression.' }, 'reviewer-1')).rejects.toMatchObject({ code: 'invalid_signal_lifecycle_transition' });
    expect((await store.listEvents()).every((event) => event.subjects.length > 0 && event.publication_state === 'public')).toBe(true);
  });
});
