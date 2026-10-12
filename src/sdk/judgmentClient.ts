import { z } from 'zod';
import { PreSpendCheckRequestSchema, type PreSpendCheckRequest } from '../schemas/entities';
import { CanonicalJudgmentResponseSchema, type CanonicalJudgmentResponse } from '../schemas/preSpend';
import { ECONOMIC_RAILS, EconomicNetworkSchema } from '../security/economicRails';
import { canonicalJson, jsonDigest, verifyJudgmentIntegrity, type TrustedJudgmentIssuer } from './judgmentIntegrity';
import type { InfopunksPreSpendClientFetch } from './preSpendClient';

export type JudgmentFailure = 'INSUFFICIENT_EVIDENCE' | 'INVALID_REQUEST' | 'UNAUTHORIZED' | 'PAYMENT_DECLINED' |
  'PAYMENT_PENDING_RECONCILIATION' | 'PAYMENT_VERIFICATION_FAILED' | 'QUOTE_EXPIRED' | 'SERVICE_UNAVAILABLE' | 'RECEIPT_VERIFICATION_FAILED' | 'CANCELLED';
export type JudgmentState = 'REQUESTED' | 'ASSESSED_FREE' | 'PAYMENT_REQUIRED' | 'PAYMENT_AUTHORIZED' | 'PAYMENT_SUBMITTED' | 'SETTLED' | 'RECEIPT_VERIFIED' | JudgmentFailure;
export type JudgeInput = { intent: string; budget: number; subject: string; risk?: 'low' | 'medium' | 'high' | 'critical'; requiredConfidence?: number };
export type JudgmentSession = { id: string; scope: string; input: PreSpendCheckRequest; state: JudgmentState; proof?: string; submitted: boolean };
/** A server-side encrypted/access-controlled adapter must implement durable storage. Browser persistence is refused. */
export interface JudgmentSessionStore {
  protection: 'process-memory' | 'server-protected';
  load(scope: string, id: string): Promise<JudgmentSession | null>;
  create(session: JudgmentSession): Promise<JudgmentSession>;
  save(session: JudgmentSession): Promise<void>;
}
export function createMemoryJudgmentSessionStore(): JudgmentSessionStore {
  const sessions = new Map<string, JudgmentSession>();
  const key = (scope: string, id: string) => scope + ':' + id;
  return { protection: 'process-memory',
    async load(scope, id) { return structuredClone(sessions.get(key(scope, id)) ?? null); },
    async create(session) { const k = key(session.scope, session.id); if (!sessions.has(k)) sessions.set(k, structuredClone(session)); return structuredClone(sessions.get(k)!); },
    async save(session) {
      const prior = sessions.get(key(session.scope, session.id));
      if (prior?.proof && session.proof && prior.proof !== session.proof) throw new Error('judgment_original_proof_conflict');
      if (prior?.proof) session.proof = prior.proof;
      sessions.set(key(session.scope, session.id), structuredClone(session));
    }
  };
}
export type JudgmentPaymentAdapter = {
  policy: { network: 'eip155:8453' | 'eip155:4663'; asset: 'USDC' | 'USDG'; payTo: string; maxAmountAtomic: string };
  authorize(input: { challenge: JudgmentChallenge; judgment: CanonicalJudgmentResponse; sessionId: string; signal?: AbortSignal }): Promise<string | null>;
};
const RequirementSchema = z.object({ scheme: z.literal('exact'), network: EconomicNetworkSchema,
  asset: z.string().regex(/^0x[a-fA-F0-9]{40}$/), payTo: z.string().regex(/^0x[a-fA-F0-9]{40}$/), amount: z.string().regex(/^[1-9][0-9]*$/),
  maxTimeoutSeconds: z.number().int().positive(), extra: z.record(z.string(), z.unknown()) });
const ChallengeSchema = z.object({ x402Version: z.literal(2), accepts: z.array(RequirementSchema).min(1).max(8),
  resource: z.object({ url: z.string().url() }).passthrough() }).passthrough();
export type JudgmentChallenge = z.infer<typeof ChallengeSchema>;
export type JudgmentResult = CanonicalJudgmentResponse & { sessionId: string; state: JudgmentState;
  verification?: Awaited<ReturnType<typeof verifyJudgmentIntegrity>>; presentation?: unknown; paymentConfirmation?: unknown };
export class InfopunksJudgmentError extends Error {
  constructor(readonly state: JudgmentFailure, readonly code: string, readonly sessionId: string, readonly nextAction: string) {
    super(`${code}: ${nextAction}`); this.name = 'InfopunksJudgmentError';
  }
}
export type CreateInfopunksClientOptions = { baseUrl?: string; apiKey: string; payment?: JudgmentPaymentAdapter;
  fetch?: InfopunksPreSpendClientFetch; sessionStore?: JudgmentSessionStore; trustedIssuer?: TrustedJudgmentIssuer;
  onAssessment?: (assessment: CanonicalJudgmentResponse) => void;
  onTransition?: (event: { version: 'judgment-workflow.v1'; sessionId: string; from: JudgmentState; to: JudgmentState }) => void };
const allowed: Partial<Record<JudgmentState, JudgmentState[]>> = {
  REQUESTED: ['ASSESSED_FREE', 'PAYMENT_REQUIRED'], ASSESSED_FREE: ['INSUFFICIENT_EVIDENCE'],
  PAYMENT_REQUIRED: ['PAYMENT_AUTHORIZED'], PAYMENT_AUTHORIZED: ['PAYMENT_SUBMITTED'], PAYMENT_SUBMITTED: ['SETTLED'], SETTLED: ['RECEIPT_VERIFIED']
};
const failures: JudgmentFailure[] = ['INSUFFICIENT_EVIDENCE','INVALID_REQUEST','UNAUTHORIZED','PAYMENT_DECLINED','PAYMENT_PENDING_RECONCILIATION','PAYMENT_VERIFICATION_FAILED','QUOTE_EXPIRED','SERVICE_UNAVAILABLE','RECEIPT_VERIFICATION_FAILED','CANCELLED'];
function atomicAmount(amount: string) {
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}
function decodeHeader(value: string | null): unknown {
  if (!value || value.length > 16384 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error();
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value), c => c.charCodeAt(0))));
}
export function createInfopunksClient(options: CreateInfopunksClientOptions) {
  const baseUrl = (options.baseUrl ?? 'https://radar.infopunks.fun').replace(/\/+$/, '');
  const parsedUrl = new URL(baseUrl);
  if (options.trustedIssuer) {
    const trusted = z.object({ issuer: z.string().min(1), keys: z.array(z.object({ key_id: z.string().min(1), public_key_pem: z.string().startsWith('-----BEGIN PUBLIC KEY-----'),
      valid_from: z.string().datetime(), valid_until: z.string().datetime().nullable(), revoked: z.boolean().optional() })).min(1) }).safeParse(options.trustedIssuer);
    if (!trusted.success || new Set(trusted.data.keys.map(k => k.key_id)).size !== trusted.data.keys.length ||
      trusted.data.keys.some(k => k.valid_until && Date.parse(k.valid_until) <= Date.parse(k.valid_from))) throw new Error('invalid_trusted_issuer_configuration');
  }
  if (parsedUrl.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(parsedUrl.hostname)) throw new Error('judgment_https_required');
  const store = options.sessionStore ?? createMemoryJudgmentSessionStore();
  if (typeof window !== 'undefined' && store.protection !== 'process-memory') throw new Error('browser_session_persistence_forbidden');
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const flights = new Map<string, { fingerprint?: string; promise: Promise<JudgmentResult> }>();
  let principalPromise: Promise<{ tenant_id: string; agent_id: string }> | undefined;
  async function scope() { return jsonDigest({ baseUrl, credential: options.apiKey }); }
  function fail(state: JudgmentFailure, code: string, id: string, action = 'Inspect the blocker before trying again.'): never { throw new InfopunksJudgmentError(state, code, id, action); }
  async function transition(session: JudgmentSession, to: JudgmentState, recovery = false) {
    const from = session.state;
    if (from === to) return;
    if (!failures.includes(to as JudgmentFailure) && !allowed[from]?.includes(to) && !recovery) throw new Error('invalid_judgment_transition');
    session.state = to; await store.save(session);
    // The event contains states only. Observer failures cannot change payment behavior.
    try { options.onTransition?.({ version: 'judgment-workflow.v1', sessionId: session.id, from, to }); } catch { /* isolated observer */ }
  }
  async function request(path: string, id: string, init: RequestInit = {}) {
    if (!options.apiKey || !/^[A-Za-z0-9_-]{32,256}$/.test(options.apiKey)) fail('UNAUTHORIZED', 'api_key_required', id, 'Configure an operator-issued tenant API key.');
    let response: Response;
    try { response = await fetchImpl(baseUrl + path, { ...init, redirect: 'error', headers: { accept: 'application/json', 'content-type': 'application/json', authorization: 'Bearer ' + options.apiKey, ...init.headers } }); }
    catch { fail(init.signal?.aborted ? 'CANCELLED' : 'SERVICE_UNAVAILABLE', 'request_interrupted', id, 'Resume this session to inspect durable server state.'); }
    let body: unknown;
    try { body = await response.json(); } catch { fail('SERVICE_UNAVAILABLE', 'invalid_service_response', id); }
    return { response, body: body as Record<string, unknown> };
  }
  function serverError(status: number, body: Record<string, unknown>, id: string): never {
    const code = typeof body.error === 'string' && /^[a-z_]{1,96}$/.test(body.error) ? body.error : 'service_error';
    const state: JudgmentFailure = status === 401 || status === 403 ? 'UNAUTHORIZED' :
      code === 'judgment_quote_expired' ? 'QUOTE_EXPIRED' :
      ['payment_pending_reconciliation','payment_already_claimed'].includes(code) ? 'PAYMENT_PENDING_RECONCILIATION' :
      code.includes('payment') && status < 500 ? 'PAYMENT_VERIFICATION_FAILED' : status === 400 || status === 409 ? 'INVALID_REQUEST' : 'SERVICE_UNAVAILABLE';
    fail(state, code, id, state === 'PAYMENT_PENDING_RECONCILIATION' ? 'Wait for independent operator reconciliation; do not resubmit payment.' : 'Inspect the blocker and retain this session.');
  }
  async function principal(id: string, signal?: AbortSignal) {
    if (!principalPromise) principalPromise = (async () => {
      const { response, body } = await request('/v1/judgment/session', id, { signal });
      if (!response.ok) serverError(response.status, body, id);
      const parsed = z.object({ tenant_id: z.string().min(1), agent_id: z.string().min(1) }).safeParse(body.data);
      if (!parsed.success) fail('UNAUTHORIZED', 'invalid_tenant_session', id);
      return parsed.data;
    })().catch(error => { principalPromise = undefined; throw error; });
    return principalPromise;
  }
  async function read(path: string, id: string, signal?: AbortSignal) {
    const { response, body } = await request(path, id, { signal });
    if (!response.ok) serverError(response.status, body, id);
    return body.data;
  }
  async function assertAssessmentBinding(result: CanonicalJudgmentResponse, session: JudgmentSession, signal?: AbortSignal) {
    const owner = await principal(session.id, signal);
    const expected = 'judgment_' + (await jsonDigest({ agent: session.input.agent_id, key: session.id, tenant: owner.tenant_id })).slice(7);
    if (result.judgment_id !== expected || (result.receipt && result.receipt.intent_hash !== await jsonDigest(session.input)))
      fail('RECEIPT_VERIFICATION_FAILED', 'assessment_request_binding_mismatch', session.id);
  }
  async function finish(session: JudgmentSession, body: Record<string, unknown>, response?: Response, recovery = false, signal?: AbortSignal): Promise<JudgmentResult> {
    const parsed = CanonicalJudgmentResponseSchema.safeParse(body);
    if (!parsed.success) fail('SERVICE_UNAVAILABLE', 'invalid_judgment_response', session.id);
    const result = parsed.data;
    await assertAssessmentBinding(result, session, signal);
    try { options.onAssessment?.(structuredClone(result)); } catch { /* presentation observer */ }
    if (!result.payment_required) {
      if (result.decision !== 'insufficient_evidence' || result.cost.amount !== '0' || result.receipt !== null) fail('RECEIPT_VERIFICATION_FAILED', 'invalid_free_assessment', session.id);
      await transition(session, 'ASSESSED_FREE', recovery); await transition(session, 'INSUFFICIENT_EVIDENCE');
      return { ...result, sessionId: session.id, state: session.state, presentation: body.presentation };
    }
    let settlement;
    try { settlement = decodeHeader(response?.headers.get('payment-response') ?? null) as { success: boolean; transaction: string; network: string }; }
    catch { fail('RECEIPT_VERIFICATION_FAILED', 'invalid_settlement_response', session.id); }
    let original;
    try { original = decodeHeader(session.proof ?? null) as { accepted: { network: string } }; } catch { fail('RECEIPT_VERIFICATION_FAILED', 'original_payment_proof_required', session.id); }
    const network = EconomicNetworkSchema.safeParse(original?.accepted?.network);
    if (!session.proof || !result.receipt || settlement.success !== true || settlement.transaction !== result.receipt.payment_receipt_ref || !network.success ||
      settlement.network !== network.data || result.cost.asset !== ECONOMIC_RAILS[network.data].asset ||
      (result.receipt.payment && settlement.network !== result.receipt.payment.network)) fail('RECEIPT_VERIFICATION_FAILED', 'settlement_receipt_mismatch', session.id);
    await transition(session, 'SETTLED', recovery);
    let verification;
    try { verification = await verifyJudgmentIntegrity(result, path => read(path, session.id, signal), options.trustedIssuer); }
    catch { fail('RECEIPT_VERIFICATION_FAILED', 'receipt_integrity_unavailable_or_invalid', session.id, 'Inspect the receipt through authenticated access; payment must not be repeated.'); }
    await transition(session, 'RECEIPT_VERIFIED');
    return { ...result, sessionId: session.id, state: session.state, verification, presentation: body.presentation, paymentConfirmation: body.payment_confirmation };
  }
  async function submit(session: JudgmentSession, signal?: AbortSignal, recovery = false) {
    if (signal?.aborted) fail('CANCELLED', 'client_cancelled', session.id);
    const paid = Boolean(session.proof);
    if (paid) { session.submitted = true; await transition(session, 'PAYMENT_SUBMITTED', recovery); }
    const { response, body } = await request('/v1/pre-spend/check', session.id, { method: 'POST', signal,
      headers: { 'idempotency-key': session.id, ...(session.proof ? { 'payment-signature': session.proof } : {}) }, body: JSON.stringify(session.input) });
    if (response.status === 200) return finish(session, body, response, recovery, signal);
    if (response.status !== 402 || paid) serverError(response.status, body, session.id);
    const assessed = CanonicalJudgmentResponseSchema.safeParse(body);
    if (!assessed.success || !assessed.data.payment_required || assessed.data.receipt || assessed.data.decision === 'insufficient_evidence' || !assessed.data.cited_observations.length || !assessed.data.reasons.length ||
      assessed.data.confidence < 0 || assessed.data.confidence > 100) fail('PAYMENT_VERIFICATION_FAILED', 'invalid_paid_assessment', session.id);
    await assertAssessmentBinding(assessed.data, session, signal);
    try { options.onAssessment?.(structuredClone(assessed.data)); } catch { /* presentation observer */ }
    let challenge: JudgmentChallenge;
    try { challenge = ChallengeSchema.parse(decodeHeader(response.headers.get('payment-required'))); }
    catch { fail('PAYMENT_VERIFICATION_FAILED', 'invalid_x402_challenge', session.id); }
    const adapter = options.payment;
    await transition(session, 'PAYMENT_REQUIRED', recovery);
    if (Date.parse(assessed.data.valid_until) <= Date.now()) fail('QUOTE_EXPIRED', 'judgment_quote_expired', session.id);
    if (!adapter) fail('PAYMENT_DECLINED', 'payment_authorization_required', session.id, 'Provide an explicit bounded payment policy and authorization adapter.');
    const policy = structuredClone(adapter.policy);
    const accepted = challenge.accepts.find(r => r.network === policy.network && r.payTo.toLowerCase() === policy.payTo.toLowerCase() &&
      r.asset.toLowerCase() === ECONOMIC_RAILS[r.network].token && ECONOMIC_RAILS[r.network].asset === policy.asset);
    if (!accepted || !/^[1-9][0-9]*$/.test(policy.maxAmountAtomic) || BigInt(accepted.amount) > BigInt(policy.maxAmountAtomic) ||
      Number(accepted.amount) / 1_000_000 > session.input.budget ||
      assessed.data.cost.asset !== policy.asset || !/^\d+(?:\.\d{1,6})?$/.test(assessed.data.cost.amount) ||
      atomicAmount(assessed.data.cost.amount) !== BigInt(accepted.amount) ||
      challenge.resource.url !== baseUrl + '/v1/pre-spend/check') fail('PAYMENT_DECLINED', 'payment_policy_rejected', session.id);
    let proof: string | null;
    try { proof = await adapter.authorize({ challenge: structuredClone({ ...challenge, accepts: [accepted] }), judgment: structuredClone(assessed.data), sessionId: session.id, signal }); }
    catch { fail(signal?.aborted ? 'CANCELLED' : 'PAYMENT_DECLINED', 'payment_authorization_declined', session.id); }
    if (!proof) fail('PAYMENT_DECLINED', 'payment_authorization_declined', session.id);
    try {
      const payment = decodeHeader(proof) as { x402Version: number; accepted: unknown };
      if (payment?.x402Version !== 2 || canonicalJson(payment.accepted) !== canonicalJson(accepted)) throw new Error();
    } catch { fail('PAYMENT_VERIFICATION_FAILED', 'invalid_authorized_proof', session.id); }
    if (signal?.aborted) fail('CANCELLED', 'client_cancelled', session.id);
    if (Date.parse(assessed.data.valid_until) <= Date.now()) fail('QUOTE_EXPIRED', 'judgment_quote_expired', session.id);
    session.proof = proof; await transition(session, 'PAYMENT_AUTHORIZED');
    return submit(session, signal);
  }
  function singleFlight(id: string, run: () => Promise<JudgmentResult>, fingerprint?: string) {
    const pending = flights.get(id);
    if (pending) {
      if (fingerprint && pending.fingerprint && fingerprint !== pending.fingerprint) return Promise.reject(new InfopunksJudgmentError('INVALID_REQUEST', 'idempotency_conflict', id, 'Use a new key for a different request.'));
      return pending.promise;
    }
    const promise = run().finally(() => flights.delete(id)); flights.set(id, { promise, fingerprint }); return promise;
  }
  async function runSession(session: JudgmentSession, run: () => Promise<JudgmentResult>) {
    try { return await run(); }
    catch (error) {
      if (error instanceof InfopunksJudgmentError) {
        await transition(session, session.submitted && ['SERVICE_UNAVAILABLE','CANCELLED'].includes(error.state) ? 'PAYMENT_PENDING_RECONCILIATION' : error.state, true);
        if (session.state === 'PAYMENT_PENDING_RECONCILIATION' && error.state !== 'PAYMENT_PENDING_RECONCILIATION') fail('PAYMENT_PENDING_RECONCILIATION', 'payment_status_unknown', session.id, 'Resume this session to check the journal; do not create a replacement payment.');
        throw error;
      }
      try { await transition(session, 'SERVICE_UNAVAILABLE', true); } catch { /* persistence unavailable */ }
      fail('SERVICE_UNAVAILABLE', 'protected_session_unavailable', session.id);
    }
  }
  return {
    judge(input: JudgeInput | PreSpendCheckRequest, settings: { idempotencyKey?: string; signal?: AbortSignal } = {}) {
      const id = settings.idempotencyKey ?? globalThis.crypto.randomUUID();
      return singleFlight(id, async () => {
        if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(id)) fail('INVALID_REQUEST', 'invalid_idempotency_key', id);
        const owner = await principal(id, settings.signal);
        let requestInput: PreSpendCheckRequest;
        try {
          if ('agent_id' in input) requestInput = PreSpendCheckRequestSchema.strict().parse(input);
          else {
            const simple = z.object({ intent: z.string().min(1), budget: z.number().finite().nonnegative(), subject: z.string().regex(/^(route|provider|service):.+$/), risk: z.enum(['low','medium','high','critical']).optional(), requiredConfidence: z.number().min(0).max(100).optional() }).strict().parse(input);
            requestInput = { agent_id: owner.agent_id, intent: simple.intent, budget: simple.budget, subject_id: simple.subject.slice(simple.subject.indexOf(':') + 1), risk_tolerance: simple.risk ?? 'low', required_confidence: simple.requiredConfidence ?? 80, preferred_settlement: 'stablecoin' };
          }
          if (requestInput.agent_id !== owner.agent_id) throw new Error();
          requestInput = JSON.parse(JSON.stringify(requestInput));
        } catch { fail('INVALID_REQUEST', 'invalid_judge_input', id, 'Use a service route subject and the credential-bound agent; token-market policy is separately gated.'); }
        const session = await store.create({ id, scope: await scope(), input: requestInput, state: 'REQUESTED', submitted: false });
        if (session.scope !== await scope() || canonicalJson(session.input) !== canonicalJson(requestInput)) fail('INVALID_REQUEST', 'idempotency_conflict', id);
        return runSession(session, () => session.state === 'REQUESTED' ? submit(session, settings.signal) : recover(session, settings.signal));
      }, JSON.stringify(input));
    },
    resume(id: string, settings: { signal?: AbortSignal } = {}) {
      return singleFlight(id, async () => {
        const session = await store.load(await scope(), id);
        if (!session || session.scope !== await scope()) fail('UNAUTHORIZED', 'protected_session_not_found', id);
        await principal(id, settings.signal);
        return runSession(session, () => recover(session, settings.signal));
      });
    }
  };
  async function recover(session: JudgmentSession, signal?: AbortSignal) {
    const { response, body } = await request('/v1/judgments/requests/' + encodeURIComponent(session.id), session.id, { signal });
    if (response.status === 404) {
      if (session.submitted) fail('PAYMENT_PENDING_RECONCILIATION', 'submitted_request_not_found', session.id);
      await transition(session, 'REQUESTED', true); return submit(session, signal);
    }
    if (!response.ok) serverError(response.status, body, session.id);
    const status = body.data as { state?: string; result?: unknown; presentation?: unknown };
    if (status?.state === 'settling') fail('PAYMENT_PENDING_RECONCILIATION', 'payment_pending_reconciliation', session.id, 'Wait for independent operator reconciliation; do not resubmit payment.');
    if (status?.state === 'assessed_free') return finish(session, { ...(status.result as Record<string, unknown>), presentation: status.presentation }, undefined, true, signal);
    if (['quoted','settled','complete'].includes(status?.state ?? '')) {
      if (['settled','complete'].includes(status.state!) && !session.proof) fail('UNAUTHORIZED', 'original_payment_proof_required', session.id);
      return submit(session, signal, true);
    }
    fail('SERVICE_UNAVAILABLE', 'invalid_journal_state', session.id);
  }
}
