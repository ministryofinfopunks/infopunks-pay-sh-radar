import { describe, expect, it } from 'vitest';
import { recoverMessageAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { InMemoryRh4663Store, Rh4663Service, type Rh4663CallReceipt, type Rh4663NormalizedEvent } from '../src/services/rh4663Service';
import {
  DeterministicTestRh4663AnchorAdapter,
  InMemoryRh4663ResolutionStore,
  PrivateKeyRh4663ResolutionSigner,
  Rh4663ResolutionService,
  buildRh4663MerkleTree,
  calculateResolution,
  verifyRh4663MerkleProof,
  type Rh4663AnchorAdapter
} from '../src/services/rh4663ResolutionService';

const keys = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  '0x5de4111afa1c4b3daadb936b0a4d48a4e2f3b547b951328d9a8f6f1c7b7a6a4e'
] as const;
const accounts = keys.map((key) => privateKeyToAccount(key));
const signer = new PrivateKeyRh4663ResolutionSigner(keys[2], 'resolution-test-key');

function event(id: string, category: Rh4663NormalizedEvent['category'], significance: number, source_status: Rh4663NormalizedEvent['source_status'] = 'fresh', detected_at = '2026-08-13T16:00:00.000Z'): Rh4663NormalizedEvent {
  return { event_id: id, detected_at, type: 'test.observation', subjects: [{ subject_type: 'market', subject_id: id }], category, metrics: {}, evidence: [], source_confidence: 90, anomaly_score: 0, significance_score: significance, lifecycle_state: 'confirmed', publication_state: 'public', source_status };
}

async function call(service: Rh4663Service, accountIndex = 0, rotation: Rh4663CallReceipt['rotation'] = 'STOCK_TOKENS', confidence = 78) {
  const account = accounts[accountIndex]; const input = { wallet: account.address, rotation, confidence }; const built = service.pulsePayload(input); const signature = await account.signMessage({ message: built.canonical_serialization }); return service.call({ ...input, signature });
}

function fixture(now = new Date('2026-08-14T01:00:00.000Z'), anchor: Rh4663AnchorAdapter = new DeterministicTestRh4663AnchorAdapter()) {
  const phase1 = new InMemoryRh4663Store(); let callNow = new Date('2026-08-13T12:00:00.000Z'); const calls = new Rh4663Service(phase1, () => callNow); const resolutions = new InMemoryRh4663ResolutionStore(); const phase2 = new Rh4663ResolutionService(phase1, resolutions, signer, anchor, () => now, () => undefined); return { phase1, calls, phase2, resolutions, setCallNow(value: Date) { callNow = value; } };
}

describe('Infopunks //4663 Phase 2 deterministic resolution', () => {
  it('rejects open windows and uses the exact half-open observation boundary', async () => {
    const { phase1, calls } = fixture(); await call(calls); await phase1.appendEvent(event('at-open', 'stock_token', 60, 'fresh', '2026-08-13T00:00:00.000Z')); await phase1.appendEvent(event('at-close', 'meme', 100, 'fresh', '2026-08-14T00:00:00.000Z'));
    const open = new Rh4663ResolutionService(phase1, new InMemoryRh4663ResolutionStore(), signer, new DeterministicTestRh4663AnchorAdapter(), () => new Date('2026-08-13T23:59:59.999Z'), () => undefined);
    await expect(open.resolve('rh4663:2026-08-13')).rejects.toMatchObject({ code: 'cannot_resolve_open_window' });
    const closed = new Rh4663ResolutionService(phase1, new InMemoryRh4663ResolutionStore(), signer, new DeterministicTestRh4663AnchorAdapter(), () => new Date('2026-08-14T00:00:00.000Z'), () => undefined); const resolution = await closed.resolve('rh4663:2026-08-13');
    expect(resolution.observations.map((item) => item.event_id)).toEqual(['at-open']); expect(resolution.resolved_category).toBe('STOCK_TOKENS');
  });

  it('is deterministic, applies frozen option-order ties, and prevents conflicts', async () => {
    const window = { window_id: 'rh4663:2026-08-13', opens_at: '2026-08-13T00:00:00.000Z', closes_at: '2026-08-14T00:00:00.000Z', closes_at_exclusive: true as const, semantics: 'fixed_utc_day' as const };
    const events = [event('stock', 'stock_token', 80), event('meme', 'meme', 80)]; const first = calculateResolution(window, events); const second = calculateResolution(window, [...events].reverse());
    expect(first).toEqual(second); expect(first).toMatchObject({ resolved_category: 'MEMES', determination: { tie: true, tie_break_reason: 'phase1_option_order_v1' } });
    const f = fixture(); await call(f.calls); await f.phase1.appendEvent(event('winner', 'stock_token', 80)); const saved = await f.phase2.resolve('rh4663:2026-08-13'); expect(await f.phase2.resolve('rh4663:2026-08-13')).toEqual(saved);
    await expect(f.resolutions.saveResolution({ ...saved, resolved_category: 'MEMES' })).rejects.toMatchObject({ code: 'conflicting_resolution' });
  });

  it('uses only the frozen stale fallback and otherwise returns NO QUALIFIED ROTATION', () => {
    const window = { window_id: 'rh4663:2026-08-13', opens_at: '2026-08-13T00:00:00.000Z', closes_at: '2026-08-14T00:00:00.000Z', closes_at_exclusive: true as const, semantics: 'fixed_utc_day' as const };
    expect(calculateResolution(window, []).resolved_category).toBe('NO_QUALIFIED_ROTATION');
    const fallback = calculateResolution(window, [event('stale', 'defi', 70, 'stale'), event('degraded', 'stock_token', 100, 'degraded')]); expect(fallback).toMatchObject({ resolved_category: 'RWA_DEFI', determination: { fallback_used: true }, provider_state: { degraded: 1 } });
    expect(calculateResolution(window, [event('weak', 'meme', 59)]).resolved_category).toBe('NO_QUALIFIED_ROTATION');
  });

  it('preserves CALL bytes and creates linked deterministic signed RESOLUTION receipts once', async () => {
    const f = fixture(); const original = await call(f.calls); const bytes = JSON.stringify(await f.phase1.getCall(original.receipt_id)); await f.phase1.appendEvent(event('winner', 'stock_token', 80)); const resolved = await f.phase2.resolve(original.window_id); const first = await f.phase2.publish(original.window_id); const second = await f.phase2.publish(original.window_id);
    expect(JSON.stringify(await f.phase1.getCall(original.receipt_id))).toBe(bytes); expect(first.receipts).toHaveLength(1); expect(second.receipts).toEqual(first.receipts);
    const receipt = first.receipts[0]; expect(receipt).toMatchObject({ receipt_id: expect.stringMatching(/^IP-RES-/), call_receipt_id: original.receipt_id, call_receipt_hash: original.payload_hash, outcome: 'CORRECT', dependencies: resolved.dependencies, immutable: true, publication_state: 'published' });
    expect((await recoverMessageAddress({ message: receipt.canonical_serialization, signature: receipt.signature })).toLowerCase()).toBe(receipt.resolution_signer);
    await expect(f.resolutions.saveResolution({ ...first.resolution, resolved_category: 'MEMES' })).rejects.toMatchObject({ code: 'conflicting_resolution' });
  });
});

describe('Infopunks //4663 acceptance Merkle tree', () => {
  it('is stable across ordering/restart, supports one and odd leaves, and rejects invalid proofs', async () => {
    const f = fixture(); const receipts = [await call(f.calls, 0), await call(f.calls, 1), await call(f.calls, 2)]; const oddA = buildRh4663MerkleTree(receipts); const oddB = buildRh4663MerkleTree([...receipts].reverse()); expect(oddA.root).toBe(oddB.root); expect(oddA.levels[0]).toHaveLength(3);
    const single = buildRh4663MerkleTree([receipts[0]]); expect(single.root).toBe(single.levels[0][0]);
    await f.phase1.appendEvent(event('winner', 'stock_token', 80)); await f.phase2.resolve('rh4663:2026-08-13'); const proof = await f.phase2.proof(receipts[1].receipt_id); expect(proof.verified).toBe(true); expect(verifyRh4663MerkleProof(receipts[0].payload_hash, proof.proof, proof.acceptance_root)).toBe(false);
  });
});

describe('Infopunks //4663 anchor and reputation', () => {
  it('tracks not-submitted, submitted, confirmed, and no duplicate submission', async () => {
    const anchor = new DeterministicTestRh4663AnchorAdapter(true); const f = fixture(new Date('2026-08-14T01:00:00.000Z'), anchor); await call(f.calls); await f.phase1.appendEvent(event('winner', 'stock_token', 80)); const resolved = await f.phase2.resolve('rh4663:2026-08-13'); expect(resolved.anchor.state).toBe('not_submitted'); expect((await f.phase2.publish(resolved.window_id)).anchor.state).toBe('submitted'); expect((await f.phase2.publish(resolved.window_id)).anchor.state).toBe('confirmed'); expect(anchor.submissions).toBe(1);
  });

  it('claims anchor submission once under concurrent publication', async () => {
    const anchor = new DeterministicTestRh4663AnchorAdapter(false); const f = fixture(new Date('2026-08-14T01:00:00.000Z'), anchor); await call(f.calls); await f.phase1.appendEvent(event('winner', 'stock_token', 80)); await f.phase2.resolve('rh4663:2026-08-13'); await Promise.all([f.phase2.publish('rh4663:2026-08-13'), f.phase2.publish('rh4663:2026-08-13')]); expect(anchor.submissions).toBe(1); expect((await f.resolutions.getResolution('rh4663:2026-08-13'))?.anchor.state).toBe('submitted');
  });

  it('records anchor failure and retries without ever reporting false confirmation', async () => {
    let submissions = 0; const anchor: Rh4663AnchorAdapter = { available: true, async submit() { submissions += 1; if (submissions === 1) throw new Error('rpc down'); return { transaction_hash: `0x${'1'.repeat(64)}` }; }, async confirmation() { return { state: 'submitted' }; } };
    const f = fixture(new Date('2026-08-14T01:00:00.000Z'), anchor); await call(f.calls); await f.phase1.appendEvent(event('winner', 'stock_token', 80)); await f.phase2.resolve('rh4663:2026-08-13'); expect((await f.phase2.publish('rh4663:2026-08-13')).anchor.state).toBe('failed'); expect((await f.phase2.publish('rh4663:2026-08-13')).anchor.state).toBe('submitted'); expect(submissions).toBe(2);
  });

  it('calculates transparent accuracy and streak in window order while excluding unresolved calls', async () => {
    const f = fixture(new Date('2026-08-14T01:00:00.000Z')); await call(f.calls, 0, 'STOCK_TOKENS'); await f.phase1.appendEvent(event('d1', 'stock_token', 80)); await f.phase2.resolve('rh4663:2026-08-13'); await f.phase2.publish('rh4663:2026-08-13');
    f.setCallNow(new Date('2026-08-14T12:00:00.000Z')); await call(f.calls, 0, 'MEMES');
    const afterOne = await f.phase2.reputation(accounts[0].address); expect(afterOne).toMatchObject({ calls: 2, resolved_calls: 1, correct_calls: 1, accuracy: 1, current_streak: 1, genesis_position: 1 });
    const phase2Later = new Rh4663ResolutionService(f.phase1, f.resolutions, signer, new DeterministicTestRh4663AnchorAdapter(), () => new Date('2026-08-15T01:00:00.000Z'), () => undefined); await f.phase1.appendEvent(event('d2', 'stock_token', 80, 'fresh', '2026-08-14T16:00:00.000Z')); await phase2Later.resolve('rh4663:2026-08-14'); await phase2Later.publish('rh4663:2026-08-14');
    expect(await phase2Later.reputation(accounts[0].address)).toMatchObject({ calls: 2, resolved_calls: 2, correct_calls: 1, accuracy: 0.5, current_streak: 0 });
  });
});
