import { describe, expect, it } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { createApp } from '../src/api/app';
import { emptyIntelligenceStore } from '../src/services/intelligenceStore';
import { MemoryRepository } from '../src/persistence/repository';
import { InMemoryRh4663Store, Rh4663Service, type Rh4663NormalizedEvent } from '../src/services/rh4663Service';
import { DeterministicTestRh4663AnchorAdapter, InMemoryRh4663ResolutionStore, PrivateKeyRh4663ResolutionSigner, Rh4663ResolutionService, RH_4663_HIGH_CONFIDENCE_THRESHOLD, RH_4663_PROOF_CATEGORY_MIN_RESOLVED } from '../src/services/rh4663ResolutionService';

const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const resolutionSigner = new PrivateKeyRh4663ResolutionSigner('0x5de4111afa1c4b3daadb936b0a4d48a4e2f3b547b951328d9a8f6f1c7b7a6a4e', 'proof-profile-test');

function event(id: string, category: Rh4663NormalizedEvent['category'], detectedAt: string): Rh4663NormalizedEvent {
  return { event_id: id, detected_at: detectedAt, type: 'proof.test.observation', subjects: [{ subject_type: 'market', subject_id: id }], category, metrics: {}, evidence: [], source_confidence: 95, anomaly_score: 0, significance_score: 80, lifecycle_state: 'confirmed', publication_state: 'public', source_status: 'fresh' };
}

async function recordWindow(phase1: InMemoryRh4663Store, calls: Rh4663Service, phase2: Rh4663ResolutionService, setCallNow: (value: Date) => void, setResolutionNow: (value: Date) => void, date: string, rotation: 'MEMES' | 'STOCK_TOKENS' | 'RWA_DEFI' | 'STABLES' | 'NO_QUALIFIED_ROTATION', confidence: number, actual: Rh4663NormalizedEvent['category'] | null) {
  setCallNow(new Date(`${date}T12:00:00.000Z`));
  const input = { wallet: account.address, rotation, confidence };
  const payload = calls.pulsePayload(input); const signature = await account.signMessage({ message: payload.canonical_serialization }); const receipt = await calls.call({ ...input, signature });
  if (!actual) return receipt;
  await phase1.appendEvent(event(`${date}-${actual}`, actual, `${date}T16:00:00.000Z`));
  setResolutionNow(new Date(new Date(`${date}T00:00:00.000Z`).getTime() + 86_400_000 + 3_600_000));
  await phase2.resolve(receipt.window_id); await phase2.publish(receipt.window_id); return receipt;
}

describe('Infopunks //4663 Phase 4 PROOF_PROFILE', () => {
  it('derives transparent accuracy, confidence methodology, categories, Genesis, and inspectable receipt links', async () => {
    const phase1 = new InMemoryRh4663Store(); let callNow = new Date(); let resolutionNow = new Date(); const calls = new Rh4663Service(phase1, () => callNow); const resolutions = new InMemoryRh4663ResolutionStore(); const phase2 = new Rh4663ResolutionService(phase1, resolutions, resolutionSigner, new DeterministicTestRh4663AnchorAdapter(), () => resolutionNow, () => undefined);
    await recordWindow(phase1, calls, phase2, (value) => { callNow = value; }, (value) => { resolutionNow = value; }, '2026-08-13', 'STOCK_TOKENS', 80, 'stock_token');
    await recordWindow(phase1, calls, phase2, (value) => { callNow = value; }, (value) => { resolutionNow = value; }, '2026-08-14', 'STOCK_TOKENS', 90, 'meme');
    await recordWindow(phase1, calls, phase2, (value) => { callNow = value; }, (value) => { resolutionNow = value; }, '2026-08-15', 'STABLES', 80, 'liquidity');
    await recordWindow(phase1, calls, phase2, (value) => { callNow = value; }, (value) => { resolutionNow = value; }, '2026-08-16', 'RWA_DEFI', 95, null);
    const profile = await phase2.proofProfile(account.address);
    expect(profile).toMatchObject({ object_type: 'PROOF_PROFILE', calls: 4, resolved: 3, correct: 2, incorrect: 1, unresolved: 1, accuracy: 0.6667, high_confidence_accuracy: 0.6667 });
    expect(profile.methodology).toMatchObject({ high_confidence_threshold: RH_4663_HIGH_CONFIDENCE_THRESHOLD, category_min_resolved: RH_4663_PROOF_CATEGORY_MIN_RESOLVED });
    expect(profile.category_breakdown.STOCK_TOKENS).toMatchObject({ calls: 2, resolved: 2, correct: 1, incorrect: 1, sample_status: 'MEANINGFUL' });
    expect(profile.category_breakdown.MEMES.sample_status).toBe('INSUFFICIENT_SAMPLE');
    expect(profile.best_supported_category.category).toBe('STOCK_TOKENS');
    expect(profile.genesis).toMatchObject({ ordinal: 1, call_receipt_id: profile.receipt_links[0].receipt_id });
    expect(profile.genesis_receipt).toEqual(profile.genesis);
    expect(profile.recent_calls).toHaveLength(4);
    expect(profile.recent_calls.every((call) => call.call_receipt_url.startsWith('/4663/proof/'))).toBe(true);
    expect(profile.receipt_links.every((link) => link.receipt_url && (link.resolution_receipt_url || link.resolution_receipt_id === null))).toBe(true);
    expect(profile).not.toHaveProperty('score'); expect(profile).not.toHaveProperty('points'); expect(profile).not.toHaveProperty('rewards');
  });

  it('keeps anonymous/private profiles separate and exposes a public receipt-backed profile with an OG card', async () => {
    const phase1 = new InMemoryRh4663Store(); const calls = new Rh4663Service(phase1, () => new Date('2026-08-13T12:00:00.000Z')); const resolutions = new InMemoryRh4663ResolutionStore(); const phase2 = new Rh4663ResolutionService(phase1, resolutions, resolutionSigner, new DeterministicTestRh4663AnchorAdapter(), () => new Date(), () => undefined);
    const input = { wallet: account.address, rotation: 'MEMES' as const, confidence: 80 }; const payload = calls.pulsePayload(input); const signature = await account.signMessage({ message: payload.canonical_serialization }); await calls.call({ ...input, signature });
    const app = await createApp(emptyIntelligenceStore(), new MemoryRepository(), { rh4663Store: phase1, rh4663ResolutionStore: resolutions, rh4663ResolutionSigner: resolutionSigner });
    try {
      const anonymous = await app.inject({ method: 'GET', url: '/v1/4663/me/proof' }); expect(anonymous.statusCode).toBe(200); expect(anonymous.headers['cache-control']).toBe('private, no-store'); expect(anonymous.json().data).toEqual({ authenticated: false, profile: null, my_4663_version: '0' });
      const mine = await app.inject({ method: 'GET', url: `/v1/4663/me/proof?wallet=${account.address}` }); expect(mine.statusCode).toBe(200); expect(mine.headers['cache-control']).toBe('private, no-store'); expect(mine.json().data.profile.object_type).toBe('PROOF_PROFILE');
      const publicProfile = await app.inject({ method: 'GET', url: `/v1/4663/proof/${account.address}` }); expect(publicProfile.statusCode).toBe(200); expect(publicProfile.headers['cache-control']).toBe('private, no-store'); expect(publicProfile.json().data).not.toHaveProperty('balance');
      const image = await app.inject({ method: 'GET', url: `/og/4663/proof/${account.address}.png` }); expect(image.statusCode).toBe(200); expect(image.headers['content-type']).toContain('image/png');
    } finally { await app.close(); }
  });
});
