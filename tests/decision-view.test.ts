import { describe, expect, it } from 'vitest';
import { createJudgmentIssuer } from '../src/security/judgmentIssuer';
import { MemoryCanonicalReceiptStore } from '../src/persistence/canonicalReceiptStore';
import { createReceiptAuthorityService } from '../src/services/receiptAuthorityService';
import type { ReceiptReader } from '../src/services/receiptAuthorityService';
import { createDecisionViewService } from '../src/services/decisionViewService';
import { DecisionViewV1Schema } from '../src/schemas/decisionView';
import { judgmentInput, observationInput } from './helpers/canonicalReceipts';
import { issuerFixture } from './helpers/judgmentIssuer';
import { setupJudgment, request } from './helpers/judgments';

const during = new Date('2026-10-07T00:00:30Z');

describe('Intelligent UI canonical decision projection', () => {
  it('returns a verified, strictly read-only view with no authority or raw payload', async () => {
    const issuer = createJudgmentIssuer(issuerFixture());
    const store = new MemoryCanonicalReceiptStore(80, issuer);
    const writer = createReceiptAuthorityService(store, 80, issuer);
    await writer.appendObservation(observationInput());
    const receipt = await writer.appendJudgment(judgmentInput());
    const view = await createDecisionViewService(store, issuer).get(receipt.judgment_id, during);
    expect(view).not.toBeNull();
    expect(DecisionViewV1Schema.safeParse(view).success).toBe(true);
    expect(view!.judgment.decision).toBe('proceed');
    expect(view!.verification).toMatchObject({ record_verified: true, assessment_eligible: true });
    expect(view!.execution).toMatchObject({ authorized: false });
    expect(view!.evidence.history_commitment).toEqual({ status: 'not_available_in_canonical_v1', hash: null });
    expect(JSON.stringify(view)).not.toContain('catalog_source');
    expect(JSON.stringify(view)).not.toContain('price');
    expect(JSON.stringify(view)).not.toContain('private_key');
  });

  it('retains the signed historical verdict but withdraws assessment eligibility after expiry', async () => {
    const issuer = createJudgmentIssuer(issuerFixture());
    const store = new MemoryCanonicalReceiptStore(80, issuer);
    const writer = createReceiptAuthorityService(store, 80, issuer);
    await writer.appendObservation(observationInput());
    await writer.appendJudgment(judgmentInput());
    const view = await createDecisionViewService(store, issuer).get('j1', new Date('2026-10-09T00:00:00Z'));
    expect(view?.judgment.decision).toBe('proceed');
    expect(view?.verification).toMatchObject({ record_verified: true, within_validity_window: false, assessment_eligible: false });
    expect(view?.execution.authorized).toBe(false);
  });

  it('never upgrades an unsigned historical judgment into spending authority', async () => {
    const store = new MemoryCanonicalReceiptStore();
    const writer = createReceiptAuthorityService(store);
    await writer.appendObservation(observationInput());
    await writer.appendJudgment(judgmentInput());
    const view = await createDecisionViewService(store, createJudgmentIssuer(issuerFixture())).get('j1', during);
    expect(view?.verification.issuer_signature_valid).toBe(false);
    expect(view?.verification.assessment_eligible).toBe(false);
    expect(view?.execution.authorized).toBe(false);
  });

  it('keeps negative and insufficient canonical decisions without pretending to authorize execution', async () => {
    for (const decision of ['test_spend_first', 'do_not_spend', 'insufficient_evidence'] as const) {
      const issuer = createJudgmentIssuer(issuerFixture());
      const store = new MemoryCanonicalReceiptStore(80, issuer);
      const writer = createReceiptAuthorityService(store, 80, issuer);
      await writer.appendObservation(observationInput());
      await writer.appendJudgment({ ...judgmentInput(), decision });
      const view = await createDecisionViewService(store, issuer).get('j1', during);
      expect(view?.judgment.decision).toBe(decision);
      expect(view?.verification.assessment_eligible).toBe(decision === 'test_spend_first');
      expect(view?.execution.authorized).toBe(false);
    }
  });

  it('returns null for unknown IDs', async () => {
    const store = new MemoryCanonicalReceiptStore();
    expect(await createDecisionViewService(store, null).get('missing', during)).toBeNull();
  });

  it('separates trusted issuer verification from stored ancestry and rejects forged signatures', async () => {
    const fixture = issuerFixture();
    const issuer = createJudgmentIssuer(fixture);
    const store = new MemoryCanonicalReceiptStore(80, issuer);
    const writer = createReceiptAuthorityService(store, 80, issuer);
    await writer.appendObservation(observationInput());
    const receipt = await writer.appendJudgment(judgmentInput());
    const revoked = createJudgmentIssuer({ issuer: fixture.issuer, keys: fixture.keys.map(key => ({ ...key, revoked: true })) });
    const revokedView = await createDecisionViewService(store, revoked).get(receipt.judgment_id, during);
    expect(revokedView?.verification).toMatchObject({ ancestry_valid: true, issuer_signature_valid: false, record_verified: false, assessment_eligible: false });

    const forgedReader = { ...store, get: async (kind: Parameters<typeof store.get>[0], id: string) => {
      const value = await store.get(kind, id);
      if (kind === 'judgment' && value && 'issuer_signature' in value && value.issuer_signature) {
        const signature = value.issuer_signature.signature;
        return { ...value, issuer_signature: { ...value.issuer_signature, signature: `${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}` } } as typeof value;
      }
      return value;
    } };
    const forgedView = await createDecisionViewService(forgedReader, issuer).get(receipt.judgment_id, during);
    expect(forgedView?.verification).toMatchObject({ ancestry_valid: false, issuer_signature_valid: false, record_verified: false, assessment_eligible: false });
  });

  it('fails closed for missing ancestry, invalid policy identity, and corrupted judgments', async () => {
    const issuer = createJudgmentIssuer(issuerFixture());
    const store = new MemoryCanonicalReceiptStore(80, issuer);
    const writer = createReceiptAuthorityService(store, 80, issuer);
    await writer.appendObservation(observationInput());
    const receipt = await writer.appendJudgment(judgmentInput());
    const missingObservationReader = { ...store, get: async (kind: Parameters<typeof store.get>[0], id: string) => kind === 'observation' ? null : store.get(kind, id) };
    const missingView = await createDecisionViewService(missingObservationReader, issuer).get(receipt.judgment_id, during);
    expect(missingView?.evidence).toMatchObject({ state: 'unavailable', missing_observation_ids: ['o1'] });
    expect(missingView?.verification).toMatchObject({ ancestry_valid: false, issuer_signature_valid: true, assessment_eligible: false });

    const invalidPolicyReader = { ...store, get: async (kind: Parameters<typeof store.get>[0], id: string) => {
      const value = await store.get(kind, id);
      return kind === 'judgment' && value && 'policy_version' in value ? { ...value, policy_version: 'receipt-authority.v2' } as typeof value : value;
    } };
    await expect(createDecisionViewService(invalidPolicyReader, issuer).get(receipt.judgment_id, during)).rejects.toThrow('canonical_judgment_invalid');

    const corruptReader = { ...store, get: async (kind: Parameters<typeof store.get>[0], id: string) => {
      const value = await store.get(kind, id);
      return kind === 'judgment' && value && 'decision' in value ? { ...value, decision: 'allow' } as unknown as typeof value : value;
    } };
    await expect(createDecisionViewService(corruptReader, issuer).get(receipt.judgment_id, during)).rejects.toThrow('canonical_judgment_invalid');
  });

  it('reports v2 history only when the canonical decision context is bound and verified', async () => {
    const issuer = createJudgmentIssuer(issuerFixture());
    const f = await setupJudgment({}, {}, {}, issuer);
    const paid = await f.service.check(request, 'decision-view-v2', f.signature);
    const receipt = paid.response.receipt!;
    const context = await f.store.getDecisionContext(receipt.judgment_id);
    expect(context).not.toBeNull();
    const view = await createDecisionViewService(f.store, issuer).get(receipt.judgment_id, new Date('2026-10-07T00:00:03Z'));
    expect(view?.evidence.history_commitment).toEqual({ status: 'committed_in_canonical_v2', hash: context?.projection_boundary.evaluation_refs_hash });
    expect(view?.verification.assessment_eligible).toBe(true);

    const corruptedContextReader: ReceiptReader = {
      judgmentTrust: f.store.judgmentTrust,
      get: (kind, id) => f.store.get(kind, id),
      getAcceptance: (kind, id) => f.store.getAcceptance(kind, id),
      getDecisionContext: async () => context && ({ ...context,
        projection_boundary: { ...context.projection_boundary, evaluation_refs_hash: `sha256:${'b'.repeat(64)}` }
      })
    };
    const corruptedContextView = await createDecisionViewService(corruptedContextReader, issuer)
      .get(receipt.judgment_id, new Date('2026-10-07T00:00:03Z'));
    expect(corruptedContextView?.evidence.history_commitment).toEqual({ status: 'unavailable', hash: null });
    expect(corruptedContextView?.verification.assessment_eligible).toBe(false);

    const missingContextReader: ReceiptReader = {
      judgmentTrust: f.store.judgmentTrust,
      get: (kind, id) => f.store.get(kind, id),
      getAcceptance: (kind, id) => f.store.getAcceptance(kind, id),
      getDecisionContext: async () => null
    };
    const missingContextView = await createDecisionViewService(missingContextReader, issuer).get(receipt.judgment_id, new Date('2026-10-07T00:00:03Z'));
    expect(missingContextView?.evidence.history_commitment).toEqual({ status: 'unavailable', hash: null });
    expect(missingContextView?.verification.assessment_eligible).toBe(false);

    const unsigned = await setupJudgment();
    const unsignedPaid = await unsigned.service.check(request, 'unsigned-decision-view-v2', unsigned.signature);
    const unsignedView = await createDecisionViewService(unsigned.store, null).get(unsignedPaid.response.receipt!.judgment_id, new Date('2026-10-07T00:00:03Z'));
    expect(unsignedView?.evidence.history_commitment).toEqual({ status: 'unavailable', hash: null });
    expect(unsignedView?.verification).toMatchObject({ issuer_signature_valid: false, record_verified: false, assessment_eligible: false });
  });
});
