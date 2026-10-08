import { generateKeyPairSync } from 'node:crypto';
import { encodePaymentSignatureHeader } from '@x402/core/http';
import { expect, it } from 'vitest';
import { createJudgmentIssuer } from '../src/security/judgmentIssuer';
import { createJudgmentService } from '../src/services/judgmentService';
import { createEvaluationService } from '../src/services/evaluationService';
import { createCausalTapeService } from '../src/services/causalTapeService';
import { createCausalWitnessService } from '../src/services/causalWitnessService';
import { verifyCausalWitnessOffline } from '../src/services/causalWitnessOfflineVerifier';
import { setupJudgment, request, legacy } from './helpers/judgments';
import { qualifyingClassifiedExecution, classifiedArtifact, observationInput } from './helpers/canonicalReceipts';
import { evaluationRequest } from './helpers/evaluations';

it('publishes paginated O/J/X/E with parent closure and immutable free insufficiency attempts', async () => {
  const f = await setupJudgment({}, { evidence_state: 'insufficient', evidence_refs: [] });
  const free = await f.service.check(request, 'free-attempt');
  expect(free.status).toBe(200);
  expect((await f.service.check(request, 'free-attempt')).response).toEqual(free.response);
  const tape = createCausalTapeService(f.store, f.journal);
  const page = await tape.page({ limit: 1 });
  expect(page.manifest.manifest_hash).toMatch(/^sha256:/);
  expect(page.free_assessment_attempts).toHaveLength(1);
  expect(page.free_assessment_attempts[0].response.decision).toBe('insufficient_evidence');
  expect(page.items[0].parent_closure[0].kind).toBe('observation');
  expect(page.counters.verified_causal_revision).toBe(0);
  const frozen = page.manifest;
  const receiptOnly = await tape.page({ acceptedThrough: 0 });
  await f.service.check(request, 'later-free-attempt');
  await expect(f.authority.appendObservation({ ...observationInput('future-tape'), observed_at: '2999-01-01T00:00:00Z',
    ingested_at: '2999-01-01T00:00:01Z' })).rejects.toMatchObject({ code: 'observation_future_timestamp_quarantined' });
  const replay = await tape.page({ acceptedThrough: frozen.accepted_through,
    freeThrough: frozen.free_attempts_through, quarantineThrough: frozen.quarantine_through });
  expect(replay.manifest.manifest_hash).toBe(frozen.manifest_hash);
  expect(replay.free_assessment_attempts).toHaveLength(1);
  expect((await tape.page({ acceptedThrough: 0 })).manifest.manifest_hash).toBe(receiptOnly.manifest.manifest_hash);
  expect((await tape.page({})).manifest.manifest_hash).not.toBe(frozen.manifest_hash);
});

it('replays a signed synthetic causal witness offline and refuses tampered counterfactual', async () => {
  const pair = generateKeyPairSync('ed25519');
  const issuer = createJudgmentIssuer({ issuer: 'fixture-issuer', keys: [{ key_id: 'fixture', public_key_pem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    valid_from: '2026-01-01T00:00:00Z', valid_until: '2027-01-01T00:00:00Z', revoked: false }], activeKeyId: 'fixture',
    privateKeyPem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() });
  const f = await setupJudgment({}, {}, {}, issuer);
  let time = '2026-10-07T00:00:02Z';
  const service = createJudgmentService({ store: f.store, journal: f.journal, gateway: f.gateway, issuer,
    legacyCheck: () => legacy, observations: async () => [f.observation], threshold: 80, ttlMs: 60000, amount: '0.01', now: () => new Date(time) });
  const first = await service.check(request, 'witness-j1', f.signature);
  const execution = await f.authority.appendExecution({ ...qualifyingClassifiedExecution(false), judgment_id: first.response.judgment_id });
  const evaluation = await createEvaluationService(f.store, 80, () => new Date('2026-10-07T00:00:04Z'))
    .submit({ ...evaluationRequest, execution_receipt_id: execution.execution_id, output_artifact: classifiedArtifact(false) }, 'canonical-admin');
  time = '2026-10-07T00:00:05Z';
  f.facilitator.settle = async () => ({ success: true, transaction: '0x' + 'b'.repeat(64), network: 'eip155:8453', payer: '0x' + '1'.repeat(40) });
  const secondSignature = encodePaymentSignatureHeader({ x402Version: 2, accepted: f.gateway.requirements[0],
    payload: { signature: 'second-witness', authorization: { nonce: 'second-witness' } } });
  const second = await service.check(request, 'witness-j2', secondSignature);
  const witness = await createCausalWitnessService(f.store, issuer).build(first.response.judgment_id, evaluation.evaluation_id, second.response.judgment_id);
  expect(witness.counterfactual.category_changed).toBe(true);
  expect(witness.real_route_verified).toBe(false);
  expect((await verifyCausalWitnessOffline(witness)).valid).toBe(true);
  expect((await verifyCausalWitnessOffline({ ...witness, counterfactual: { ...witness.counterfactual, category_changed: false } })).valid).toBe(false);
});
