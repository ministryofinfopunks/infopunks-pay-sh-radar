import { describe, expect, it, vi } from 'vitest';
import { economicFixture, economicJob, jevChoice } from './helpers/economicEngine';
import { buildDecisionEnvelope, validateJevResponse, requestJevWitness } from '../src/services/jevWitness';
import { judgeEconomicDecision } from '../src/services/judge';
import { hashCanonical } from '../src/services/receiptIntegrityService';
import { createEconomicExecutionGate } from '../src/services/economicExecutionGate';
import { createEconomicJudgmentEngine, type ExecutorOutcome } from '../src/services/economicJudgmentEngine';
import { createExecutionAuthorizationIssuer } from '../src/security/executionAuthorization';
import { issuerFixture } from './helpers/judgmentIssuer';
import { createEconomicPrecedentService } from '../src/services/economicPrecedentService';

describe('host-bound Jev witnesses', () => {
  const at = new Date('2026-10-08T00:00:02Z');
  it('retains exact state/menu/policy hashes and validates a typed selection', () => {
    const job = economicJob(), envelope = buildDecisionEnvelope(job, at);
    const witness = validateJevResponse(job, envelope, jevChoice(), at);
    expect(witness.answer).toMatchObject({ kind: 'choice', candidate_id: 'route-a' });
    expect(witness.envelope_hash).toBe(hashCanonical(envelope));
  });
  it.each([
    ['model', (r: ReturnType<typeof jevChoice>) => { r.model = 'jev-latest'; }],
    ['unknown option', (r: ReturnType<typeof jevChoice>) => { r.answers.decision.choice = 'evil-route'; }],
    ['sum', (r: ReturnType<typeof jevChoice>) => { r.answers.decision.probabilities.abstain = 0.5; }],
    ['inconsistent choice', (r: ReturnType<typeof jevChoice>) => { r.answers.decision.choice = 'abstain'; }],
    ['nonfinite', (r: ReturnType<typeof jevChoice>) => { r.answers.decision.confidence = NaN; }]
  ])('abstains on %s instead of granting authority', (_label, mutate) => {
    const job = economicJob(), raw = jevChoice(); mutate(raw);
    expect(validateJevResponse(job, buildDecisionEnvelope(job, at), raw, at).answer.kind).toBe('abstain');
  });
  it('normalizes explicit abstention and expiry', () => {
    const job = economicJob(), envelope = buildDecisionEnvelope(job, at), raw = jevChoice();
    raw.answers.decision.choice = 'abstain'; raw.answers.decision.probabilities = { 'route-a': 0.1, abstain: 0.9 };
    expect(validateJevResponse(job, envelope, raw, at).answer).toMatchObject({ reason_code: 'jev_selected_abstain' });
    expect(validateJevResponse(job, envelope, jevChoice(), new Date(envelope.expires_at)).answer).toMatchObject({ reason_code: 'jev_response_expired' });
  });
  it('maps uncertain Noul to a host abstention without inventing confidence', () => {
    const job = economicJob(); job.question = { type: 'noul', instructions: 'Does evidence support the claim?', no_threshold: 0.2, yes_threshold: 0.8 };
    const raw = { model: job.model_id, answers: { decision: { type: 'noul', noul: 0.5 } }, usage: { input_tokens: 10, output_tokens: 1 } };
    expect(validateJevResponse(job, buildDecisionEnvelope(job, at), raw, at).answer).toMatchObject({ reason_code: 'jev_uncertain_noul' });
    raw.answers.decision.noul = 0.9;
    expect(validateJevResponse(job, buildDecisionEnvelope(job, at), raw, at).answer).toEqual({ kind: 'noul', probability_yes: 0.9 });
  });
  it('verifies score bounds, legend, probabilities and weighted value against the rubric', () => {
    const job = economicJob(); job.question = { type: 'score', instructions: 'Rate evidence', criteria: ['missing', 'partial', 'complete'] };
    const raw = { model: job.model_id, answers: { decision: { type: 'score', score: 1.5, legend: { '0': 'missing', '1': 'partial', '2': 'complete' },
      probabilities: { '0': 0, '1': 0.5, '2': 0.5 }, confidence: 0.5 } }, usage: { input_tokens: 10, output_tokens: 1 } };
    expect(validateJevResponse(job, buildDecisionEnvelope(job, at), raw, at).answer).toMatchObject({ kind: 'score', value: 1.5 });
    raw.answers.decision.score = 5;
    expect(validateJevResponse(job, buildDecisionEnvelope(job, at), raw, at).answer.kind).toBe('abstain');
  });
  it('bounds time even when the provider ignores abort and never retries inference', async () => {
    const job = economicJob(), provider = { evaluate: vi.fn(() => new Promise<unknown>(() => {})) };
    expect((await requestJevWitness(job, buildDecisionEnvelope(job, at), provider, () => at, 5)).answer).toMatchObject({ reason_code: 'jev_timeout' });
    expect(provider.evaluate).toHaveBeenCalledTimes(1);
  });
});

describe('economic judgment and separate execution authority', () => {
  it('publishes an assessment and a distinct signed capability; executes once and retains ancestry', async () => {
    const f = await economicFixture(), attempt = await f.engine.decide(f.job, 'agent-1');
    expect(attempt.result?.verdict).toBe('ALLOW');
    expect(attempt.judgment?.decision).toBe('proceed');
    expect(f.judgmentIssuer.verify(attempt.judgment!)).toBe(true);
    expect(f.authorizationIssuer.verify(attempt.authorization, f.options.now!())).toBe(true);
    expect(f.authorizationIssuer.verify(attempt.judgment, f.options.now!())).toBe(false);
    const gate = createEconomicExecutionGate(f.engine);
    const execution = await gate.execute(attempt.authorization, f.job.candidates[0].operation!, 'delegate-1', 'executor-1');
    expect(execution.state).toBe('finalized'); expect(execution.receipt?.judgment_id).toBe(attempt.judgment?.judgment_id);
    expect(await gate.execute(attempt.authorization, f.job.candidates[0].operation!, 'delegate-1', 'executor-1')).toEqual(execution);
    expect(f.executor.execute).toHaveBeenCalledTimes(1);
    expect((await f.engine.decide(f.job, 'agent-1')).authorization).toEqual(attempt.authorization);
    expect(f.provider.evaluate).toHaveBeenCalledTimes(1);
  });
  it('keeps assessment-only and shadow modes from creating executable authority', async () => {
    const assessment = await economicFixture({ allowAuthorizations: false });
    const a = await assessment.engine.decide(assessment.job, 'agent-1');
    expect(a.judgment).not.toBeNull(); expect(a.authorization).toBeNull();
    const shadow = await economicFixture({ shadow: true });
    const b = await shadow.engine.decide(shadow.job, 'agent-1');
    expect(b.result?.verdict).toBe('ALLOW'); expect(b.judgment).toBeNull(); expect(b.authorization).toBeNull();
  });
  it.each([
    ['disabled policy', (job: ReturnType<typeof economicJob>) => { job.policy.enabled = false; }, 'BLOCK'],
    ['recipient', (job: ReturnType<typeof economicJob>) => { job.policy.allowed_recipients = []; }, 'BLOCK'],
    ['amount', (job: ReturnType<typeof economicJob>) => { job.policy.max_amount_atomic = '9999'; }, 'BLOCK'],
    ['fee', (job: ReturnType<typeof economicJob>) => { job.policy.max_fee_atomic = '999'; }, 'BLOCK'],
    ['manual review', (job: ReturnType<typeof economicJob>) => { job.policy.manual_review_required = true; }, 'UNPROVEN'],
    ['unsupported rail', (job: ReturnType<typeof economicJob>) => { job.policy.allowed_profiles = []; }, 'UNPROVEN'],
    ['confidence', (job: ReturnType<typeof economicJob>) => { job.policy.choice_confidence_threshold = 0.99; }, 'UNPROVEN']
  ])('fails closed on %s', async (_label, mutate, verdict) => {
    const f = await economicFixture({}, mutate), attempt = await f.engine.decide(f.job, 'agent-1');
    expect(attempt.result?.verdict).toBe(verdict); expect(attempt.authorization).toBeNull();
  });
  it('retains an outage as a receiptless attempt, with no economic action', async () => {
    const f = await economicFixture({ provider: null });
    const attempt = await f.engine.decide(f.job, 'agent-1');
    expect(attempt.result?.verdict).toBe('UNPROVEN'); expect(attempt.judgment).toBeNull(); expect(attempt.authorization).toBeNull();
    expect(await f.engine.getAttempt(attempt.attempt_id)).toEqual(attempt);
  });
  it('authenticates principal and minimum evidence policy before spending inference budget', async () => {
    const f = await economicFixture();
    await expect(f.engine.decide(f.job, 'another-agent')).rejects.toMatchObject({ code: 'principal_scope_denied' });
    await expect(f.engine.decide({ ...f.job, policy: { ...f.job.policy, evidence_threshold: 1 } }, 'agent-1')).rejects.toMatchObject({ code: 'configured_evidence_threshold_required' });
    expect(f.provider.evaluate).not.toHaveBeenCalled();
  });
  it('runs a host deterministic selection without Jev, while retaining all evidence gates', async () => {
    const f = await economicFixture({ deterministicSelect: async () => ({ candidate_id: 'route-a', rule_id: 'single_prequalified_route' }) });
    const a = await f.engine.decide(f.job, 'agent-1');
    expect(a.witness?.source).toBe('deterministic'); expect(a.result?.verdict).toBe('ALLOW');
    expect(f.provider.evaluate).not.toHaveBeenCalled();
  });
  it('recovers an assessed attempt after canonical publication failure without new inference', async () => {
    const f = await economicFixture(), append = f.receipts.append.bind(f.receipts);
    let fail = true;
    f.receipts.append = async (kind, value) => { if (kind === 'judgment' && fail) { fail = false; throw new Error('publication unavailable'); } return append(kind, value); };
    await expect(f.engine.decide(f.job, 'agent-1')).rejects.toThrow('publication unavailable');
    const recovered = await f.engine.decide(f.job, 'agent-1');
    expect(recovered.authorization).not.toBeNull(); expect(f.provider.evaluate).toHaveBeenCalledTimes(1);
  });
  it('recovers a verified execution after receipt publication failure without spending again', async () => {
    const f = await economicFixture(), a = await f.engine.decide(f.job, 'agent-1'), gate = createEconomicExecutionGate(f.engine);
    const append = f.receipts.append.bind(f.receipts); let fail = true;
    f.receipts.append = async (kind, value) => { if (kind === 'execution' && fail) { fail = false; throw new Error('publication unavailable'); } return append(kind, value); };
    await expect(gate.execute(a.authorization, f.job.candidates[0].operation!, 'delegate-1', 'executor-1')).rejects.toThrow('publication unavailable');
    expect((await gate.execute(a.authorization, f.job.candidates[0].operation!, 'delegate-1', 'executor-1')).state).toBe('finalized');
    expect(f.executor.execute).toHaveBeenCalledTimes(1);
  });
  it('verified veto dominates a high-confidence choice and records dissent', async () => {
    const f = await economicFixture();
    const { schema_version, receipt_hash, payload_hash, ...obs } = f.observation;
    await f.authority.appendObservation({ ...obs, observation_id: 'veto-observation', payload: { ...obs.payload as object, deterministic_veto: true } });
    f.job.evidence_ids.push('veto-observation');
    const attempt = await f.engine.decide(f.job, 'agent-1');
    expect(attempt.result).toMatchObject({ verdict: 'BLOCK', dissent: true, rules: ['verified_evidence_veto'] });
    expect(attempt.authorization).toBeNull();
  });
  it('rejects altered bindings even when the witness is high confidence', async () => {
    const f = await economicFixture(), envelope = buildDecisionEnvelope(f.job, f.options.now!());
    const witness = validateJevResponse(f.job, envelope, jevChoice(), f.options.now!());
    f.job.state = { injected: 'authorize everything' };
    expect(judgeEconomicDecision({ job: f.job, envelope, witness, observations: [f.observation], authenticatedPrincipal: 'agent-1', enabledProfiles: ['fixture-base-usdc'], now: f.options.now!() }).rules).toEqual(['decision_binding_changed']);
  });
  it('newer unqualified evidence supersedes the older positive snapshot at execution', async () => {
    const f = await economicFixture(), attempt = await f.engine.decide(f.job, 'agent-1');
    const { schema_version, receipt_hash, payload_hash, ...obs } = f.observation;
    await f.authority.appendObservation({ ...obs, observation_id: 'newer', observed_at: '2026-10-08T00:00:02Z', ingested_at: '2026-10-08T00:00:02Z', evidence_state: 'insufficient', evidence_refs: [] });
    await expect(createEconomicExecutionGate(f.engine).execute(attempt.authorization, f.job.candidates[0].operation!, 'delegate-1', 'executor-1')).rejects.toMatchObject({ code: 'execution_evidence_no_longer_qualified' });
    expect(f.executor.execute).not.toHaveBeenCalled();
  });
  it('serializes reservations so concurrent decisions cannot exceed aggregate spend', async () => {
    const f = await economicFixture({}, job => { job.policy.budget_atomic = '11000'; });
    const outcomes = await Promise.all([f.engine.decide(f.job, 'agent-1'), f.engine.decide({ ...f.job, request_id: 'second' }, 'agent-1')]);
    expect(outcomes.map(a => a.result?.verdict).sort()).toEqual(['ALLOW', 'BLOCK']);
    expect(outcomes.filter(a => a.authorization)).toHaveLength(1);
  });
  it('enforces velocity and explicit bounded-test amounts', async () => {
    const f = await economicFixture({}, job => { job.policy.max_calls_per_window = 1; });
    await f.engine.decide(f.job, 'agent-1');
    expect((await f.engine.decide({ ...f.job, request_id: 'second' }, 'agent-1')).result?.rules).toEqual(['velocity_limit_exceeded']);
    const bounded = await economicFixture();
    const { schema_version, receipt_hash, payload_hash, ...obs } = bounded.observation;
    await bounded.authority.appendObservation({ ...obs, observation_id: 'bounded', source_id: 'bounded-source', payload: { ...obs.payload as object, bounded_test_required: true } });
    // Bind a candidate to the bounded observation by starting from a fresh fixture.
    const directEnvelope = buildDecisionEnvelope(bounded.job, bounded.options.now!());
    const directWitness = validateJevResponse(bounded.job, directEnvelope, jevChoice(), bounded.options.now!());
    const updated = { ...bounded.observation, payload: { ...bounded.observation.payload as object, bounded_test_required: true } };
    const { sealReceipt } = await import('../src/services/receiptIntegrityService');
    const rehashed = sealReceipt('observation', { ...updated, payload_hash: hashCanonical(updated.payload) });
    expect(judgeEconomicDecision({ job: bounded.job, envelope: directEnvelope, witness: directWitness, observations: [rehashed], authenticatedPrincipal: 'agent-1', enabledProfiles: ['fixture-base-usdc'], now: bounded.options.now!() }).verdict).toBe('DEGRADE');
  });
  it('rejects changed operations, delegate, audience, signature, expiry and revoked policy', async () => {
    const f = await economicFixture(), attempt = await f.engine.decide(f.job, 'agent-1'), gate = createEconomicExecutionGate(f.engine), op = f.job.candidates[0].operation!;
    await expect(gate.execute(attempt.judgment, op, 'delegate-1', 'executor-1')).rejects.toMatchObject({ code: 'invalid_execution_capability' });
    await expect(gate.execute(attempt.authorization, { ...op, recipient: 'evil' }, 'delegate-1', 'executor-1')).rejects.toMatchObject({ code: 'execution_capability_scope_denied' });
    await expect(gate.execute(attempt.authorization, op, 'other', 'executor-1')).rejects.toMatchObject({ code: 'execution_capability_scope_denied' });
    await expect(gate.execute(attempt.authorization, op, 'delegate-1', 'other')).rejects.toMatchObject({ code: 'execution_capability_scope_denied' });
    const forged = structuredClone(attempt.authorization!); forged.signature = 'A'.repeat(86) + '==';
    await expect(gate.execute(forged, op, 'delegate-1', 'executor-1')).rejects.toMatchObject({ code: 'execution_capability_invalid' });
    f.setPolicy({ ...f.job.policy, enabled: false });
    await expect(gate.execute(attempt.authorization, op, 'delegate-1', 'executor-1')).rejects.toMatchObject({ code: 'execution_policy_revoked' });
    f.setPolicy(f.job.policy); f.setTime(attempt.authorization!.payload.valid_until);
    await expect(gate.execute(attempt.authorization, op, 'delegate-1', 'executor-1')).rejects.toMatchObject({ code: 'execution_capability_invalid' });
    expect(f.executor.execute).not.toHaveBeenCalled();
  });
  it('leaves ambiguous submission reserved and reconciles without another execution', async () => {
    const f = await economicFixture(), attempt = await f.engine.decide(f.job, 'agent-1');
    const outcome: ExecutorOutcome = { finalized: true, settlement_ref: 'recovered', response_hash: hashCanonical({ ok: true }), status: 'succeeded', amount_atomic: '10000', fee_atomic: '0', artifact_refs: ['artifact://recovered'] };
    f.executor.execute = vi.fn(async () => { throw new Error('response lost'); });
    f.executor.reconcile = vi.fn(async () => outcome);
    const gate = createEconomicExecutionGate(f.engine), op = f.job.candidates[0].operation!;
    await expect(gate.execute(attempt.authorization, op, 'delegate-1', 'executor-1')).rejects.toMatchObject({ code: 'execution_pending_reconciliation' });
    await expect(gate.execute(attempt.authorization, op, 'delegate-1', 'executor-1')).rejects.toMatchObject({ code: 'execution_pending_reconciliation' });
    f.setTime('2026-10-08T01:00:00Z');
    expect((await gate.reconcile(attempt.authorization!.payload.authorization_id)).state).toBe('finalized');
    expect(f.executor.execute).toHaveBeenCalledTimes(1);
  });
  it('only one concurrent execution may claim the capability', async () => {
    const f = await economicFixture(), a = await f.engine.decide(f.job, 'agent-1'), gate = createEconomicExecutionGate(f.engine);
    const outcomes = await Promise.allSettled([gate.execute(a.authorization, f.job.candidates[0].operation!, 'delegate-1', 'executor-1'), gate.execute(a.authorization, f.job.candidates[0].operation!, 'delegate-1', 'executor-1')]);
    expect(outcomes.some(o => o.status === 'fulfilled')).toBe(true); expect(f.executor.execute).toHaveBeenCalledTimes(1);
  });
  it('persists capability revocation across engine reconstruction and releases unsubmitted capacity', async () => {
    const f = await economicFixture({}, job => { job.policy.budget_atomic = '11000'; });
    const a = await f.engine.decide(f.job, 'agent-1'), gate = createEconomicExecutionGate(f.engine);
    await gate.revoke({ authorization_id: a.authorization!.payload.authorization_id, reason: 'operator_revoked' });
    const restarted = createEconomicJudgmentEngine(f.options);
    await expect(createEconomicExecutionGate(restarted).execute(a.authorization, f.job.candidates[0].operation!, 'delegate-1', 'executor-1')).rejects.toMatchObject({ code: 'execution_capability_revoked' });
    expect((await restarted.decide({ ...f.job, request_id: 'new-capability' }, 'agent-1')).authorization).not.toBeNull();
    expect(f.executor.execute).not.toHaveBeenCalled();
  });
  it('a revoked profile blocks new authority across processes and keeps pending exposure reserved', async () => {
    const f = await economicFixture(), a = await f.engine.decide(f.job, 'agent-1'), gate = createEconomicExecutionGate(f.engine);
    f.executor.execute = vi.fn(async () => { throw new Error('unknown submission'); });
    await expect(gate.execute(a.authorization, f.job.candidates[0].operation!, 'delegate-1', 'executor-1')).rejects.toMatchObject({ code: 'execution_pending_reconciliation' });
    await gate.revoke({ profile_id: 'fixture-base-usdc', reason: 'provider_disabled' });
    const next = await createEconomicJudgmentEngine(f.options).decide({ ...f.job, request_id: 'next' }, 'agent-1');
    expect(next.result?.rules).toEqual(['execution_profile_revoked']); expect(next.authorization).toBeNull();
    const reservations = await f.options.store.transaction(tx => tx.list<{ state: string }>('reservation'));
    expect(reservations.some(r => r.state === 'submitted')).toBe(true);
  });
  it('bounds a stalled execution while preserving the claim for reconciliation', async () => {
    const f = await economicFixture({ executorTimeoutMs: 5 }), a = await f.engine.decide(f.job, 'agent-1');
    f.executor.execute = vi.fn(() => new Promise<ExecutorOutcome>(() => {}));
    await expect(createEconomicExecutionGate(f.engine).execute(a.authorization, f.job.candidates[0].operation!, 'delegate-1', 'executor-1')).rejects.toMatchObject({ code: 'execution_pending_reconciliation' });
    const reservations = await f.options.store.transaction(tx => tx.list<{ state: string }>('reservation'));
    expect(reservations[0].state).toBe('submitted'); expect(f.executor.execute).toHaveBeenCalledTimes(1);
  });
  it('records trace gaps, repeats and conflicts without promoting telemetry to reputation', async () => {
    const f = await economicFixture(), a = await f.engine.decide(f.job, 'agent-1'), precedent = createEconomicPrecedentService(f.engine);
    const event = { version: 'infopunks.harness-event.v1', event_id: 'event-1', trace_id: 'trace-1', run_id: 'run-1', step_id: 'step-1', sequence: 0,
      parent_step_id: null, principal_id: 'agent-1', event_type: 'tool_started', at: '2026-10-08T00:00:02Z', source_harness: 'fixture', adapter_version: 'v1',
      intent_hash: f.job.intent_hash, tool_id: 'balance', arguments_hash: f.job.candidates[0].operation!.arguments_hash, evidence_ids: [], artifact_hashes: [], error_code: null,
      latency_ms: null, attempt_id: a.attempt_id, authorization_id: a.authorization!.payload.authorization_id, execution_id: null };
    await precedent.recordEvent(event, 'agent-1');
    await precedent.recordEvent({ ...event, sequence: 2, event_id: 'event-2', step_id: 'step-2' }, 'agent-1');
    const trace = await precedent.inspectTrace('agent-1', 'trace-1', 'run-1');
    expect(trace).toMatchObject({ coverage: 'incomplete', missing_sequences: [1], repeated_tool_events: ['event-2'], reputation_authority: false });
    await expect(precedent.recordEvent({ ...event, event_id: 'conflict' }, 'agent-1')).rejects.toMatchObject({ code: 'trace_sequence_conflict' });
    expect(await f.receipts.list('evaluation')).toHaveLength(0);
  });
  it('keeps unknown costs null until an independently verified append-only resolution and complete cost coverage', async () => {
    const f = await economicFixture(), a = await f.engine.decide(f.job, 'agent-1'), precedent = createEconomicPrecedentService(f.engine);
    const base = { attempt_id: a.attempt_id, at: f.options.now!().toISOString(), asset_id: 'USD', settlement_ref: null, provenance: 'measured_internal' };
    const unknownId = 'inference_attempt_' + a.attempt_id;
    await expect(precedent.recordCost({ ...base, entry_id: 'unverified', category: 'inference', amount_atomic: '10', resolves_entry_id: unknownId }, async () => false)).rejects.toMatchObject({ code: 'cost_provenance_unverified' });
    await precedent.recordCost({ ...base, entry_id: 'resolved', category: 'inference', amount_atomic: '10', resolves_entry_id: unknownId }, async () => true);
    expect((await precedent.economics(a.attempt_id, 'USD')).contribution_margin_atomic).toBeNull();
    for (const category of ['refund', 'verification', 'payment_fee', 'gas', 'reconciliation']) await precedent.recordCost({ ...base, entry_id: category, category, amount_atomic: '0' }, async () => true);
    expect((await precedent.economics(a.attempt_id, 'USD')).contribution_margin_atomic).toBe('-10');
    expect((await precedent.economics(a.attempt_id, 'USD')).distributable_surplus).toBeNull();
    expect((await precedent.summary()).jev_inference_calls).toBe(1);
  });
  it('restart replays the original decision without repeating inference or signing under a new key', async () => {
    const f = await economicFixture(), original = await f.engine.decide(f.job, 'agent-1');
    const next = issuerFixture('next-key');
    const restarted = createEconomicJudgmentEngine({ ...f.options, authorizationIssuer: createExecutionAuthorizationIssuer(next) });
    expect(await restarted.decide(f.job, 'agent-1')).toEqual(original); expect(f.provider.evaluate).toHaveBeenCalledTimes(1);
    await expect(restarted.decide({ ...f.job, state: 'different' }, 'agent-1')).rejects.toMatchObject({ code: 'decision_idempotency_conflict' });
  });
  it('requires verified outcome evidence to change reputation; telemetry remains non-authoritative', async () => {
    const f = await economicFixture(), attempt = await f.engine.decide(f.job, 'agent-1'), precedent = createEconomicPrecedentService(f.engine);
    const x = await createEconomicExecutionGate(f.engine).execute(attempt.authorization, f.job.candidates[0].operation!, 'delegate-1', 'executor-1');
    await expect(precedent.evaluateExecution(x.execution_id, async () => null)).rejects.toMatchObject({ code: 'evaluation_outcome_unproven' });
    const evaluated = await precedent.evaluateExecution(x.execution_id, async () => ({ outcome: 'confirmed', evidence_refs: ['artifact://verified-output'] }));
    expect(evaluated.score_delta).toBe(5);
    expect(await precedent.evaluateExecution(x.execution_id, async () => ({ outcome: 'confirmed', evidence_refs: ['artifact://verified-output'] }))).toEqual(evaluated);
    expect((await precedent.economics(attempt.attempt_id, 'USD')).contribution_margin_atomic).toBeNull();
  });
});
