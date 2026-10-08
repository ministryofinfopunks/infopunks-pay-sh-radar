import { z } from 'zod';
import { EconomicJobSchema, JevWitnessSchema, type EconomicJob, type DecisionEnvelope, type JevWitness } from '../schemas/economicEngine';
import { hashCanonical, canonicalSerialize } from './receiptIntegrityService';

export const PROBABILITY_TOLERANCE = 0.000001;
export function buildDecisionEnvelope(raw: EconomicJob, at: Date): DecisionEnvelope {
  const job = EconomicJobSchema.parse(raw);
  if (canonicalSerialize(job.state).length > 65536) throw new Error('decision_state_too_large');
  return { version: 'infopunks.decision.v1', request_id: job.request_id, principal_id: job.principal_id,
    role: job.role, intent_hash: job.intent_hash, state_hash: hashCanonical(job.state), menu_hash: hashCanonical(job.candidates),
    policy_hash: hashCanonical(job.policy), rubric_hash: hashCanonical(job.question), model_id: job.model_id,
    expires_at: new Date(at.getTime() + job.policy.ttl_ms).toISOString(), candidates: job.candidates, evidence_ids: job.evidence_ids };
}
export function jevRequest(job: EconomicJob) {
  const criteria = Object.fromEntries([...job.candidates.map(c => [c.id, c.description]), ['abstain', 'Required evidence is missing, contradictory, or no supplied option fits.']]);
  const question = job.question.type === 'choice' ? { type: 'choice', instructions: job.question.instructions, criteria }
    : job.question.type === 'score' ? { type: 'score', instructions: job.question.instructions, criteria: job.question.criteria }
    : { type: 'noul', instructions: job.question.instructions };
  return { model: job.model_id, state: job.state, questions: { decision: question } };
}
const probabilityMap = z.record(z.string(), z.number().finite().min(0).max(1));
const confidence = z.number().finite().min(0).max(1);
const ProviderResponseSchema = z.object({
  model: z.string(), answers: z.object({ decision: z.discriminatedUnion('type', [
    z.object({ type: z.literal('choice'), choice: z.string(), probabilities: probabilityMap, confidence }).strict(),
    z.object({ type: z.literal('score'), score: z.number().finite(), legend: z.record(z.string(), z.string()), probabilities: probabilityMap, confidence }).strict(),
    z.object({ type: z.literal('noul'), noul: z.number().finite().min(0).max(1) }).strict()
  ]) }).strict(), usage: z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative() }).strict()
}).strict();
function validDistribution(map: Record<string, number>, keys: string[]) {
  return Object.keys(map).sort().join('\0') === [...keys].sort().join('\0')
    && Math.abs(Object.values(map).reduce((a, b) => a + b, 0) - 1) <= PROBABILITY_TOLERANCE;
}
export function abstainWitness(envelope: DecisionEnvelope, reason: string, at: Date, responseHash: string | null = null): JevWitness {
  return { source: 'jev', envelope_hash: hashCanonical(envelope), provider_response_hash: responseHash, returned_model_id: envelope.model_id,
    answer: { kind: 'abstain', reason_code: reason }, received_at: at.toISOString(), evidence_ids: [...envelope.evidence_ids], usage: null };
}
export function validateJevResponse(job: EconomicJob, envelope: DecisionEnvelope, raw: unknown, at: Date): JevWitness {
  let responseHash: string | null = null;
  try { responseHash = hashCanonical(raw); } catch { /* Malformed non-JSON data remains an abstention. */ }
  const fail = (reason: string) => abstainWitness(envelope, reason, at, responseHash);
  const parsed = ProviderResponseSchema.safeParse(raw);
  if (!parsed.success) return fail('jev_invalid_response');
  const result = parsed.data, answer = result.answers.decision;
  if (result.model !== envelope.model_id) return fail('jev_model_mismatch');
  if (answer.type !== job.question.type) return fail('jev_question_mismatch');
  if (at.getTime() >= Date.parse(envelope.expires_at)) return fail('jev_response_expired');
  let normalized: JevWitness['answer'];
  if (answer.type === 'choice') {
    const keys = [...job.candidates.map(c => c.id), 'abstain'];
    if (!validDistribution(answer.probabilities, keys) || !keys.includes(answer.choice)
      || answer.probabilities[answer.choice] < Math.max(...Object.values(answer.probabilities))) return fail('jev_invalid_distribution');
    normalized = answer.choice === 'abstain' ? { kind: 'abstain', reason_code: 'jev_selected_abstain' }
      : { kind: 'choice', candidate_id: answer.choice, probabilities: answer.probabilities, confidence: answer.confidence };
  } else if (answer.type === 'score' && job.question.type === 'score') {
    const keys = job.question.criteria.map((_, i) => String(i));
    if (!validDistribution(answer.probabilities, keys) || Object.keys(answer.legend).sort().join('\0') !== keys.sort().join('\0')
      || job.question.criteria.some((level, i) => answer.legend[String(i)] !== level)
      || answer.score < 0 || answer.score > job.question.criteria.length - 1
      || Math.abs(answer.score - Object.entries(answer.probabilities).reduce((sum, [k, p]) => sum + Number(k) * p, 0)) > PROBABILITY_TOLERANCE) return fail('jev_invalid_score');
    normalized = { kind: 'score', value: answer.score, rubric_hash: envelope.rubric_hash, probabilities: answer.probabilities, confidence: answer.confidence };
  } else if (answer.type === 'noul' && job.question.type === 'noul') {
    normalized = answer.noul > job.question.no_threshold && answer.noul < job.question.yes_threshold
      ? { kind: 'abstain', reason_code: 'jev_uncertain_noul' } : { kind: 'noul', probability_yes: answer.noul };
  } else return fail('jev_question_mismatch');
  return JevWitnessSchema.parse({ source: 'jev', envelope_hash: hashCanonical(envelope), provider_response_hash: responseHash,
    returned_model_id: result.model, answer: normalized, received_at: at.toISOString(), evidence_ids: envelope.evidence_ids, usage: result.usage });
}

export interface JevProvider { evaluate(request: ReturnType<typeof jevRequest>, signal: AbortSignal): Promise<unknown> }
/** Fixed provider origin; no state or caller supplied URL can redirect credentials. */
export function createJevHttpProvider(apiKey: string, fetchImpl: typeof fetch = fetch): JevProvider {
  if (!apiKey) throw new Error('jev_api_key_required');
  return { async evaluate(request, signal) {
    const response = await fetchImpl('https://api.typesafe.ai/v1/systemone', { method: 'POST', redirect: 'error', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(request) });
    if (!response.ok) throw new Error('jev_provider_unavailable');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('jev_empty_response');
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length;
        if (size > 65536) { await reader.cancel(); throw new Error('jev_response_too_large'); } chunks.push(chunk.value); }
    } finally { reader.releaseLock(); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } };
}
export async function requestJevWitness(job: EconomicJob, envelope: DecisionEnvelope, provider: JevProvider | null,
  now: () => Date = () => new Date(), timeoutMs = 3000): Promise<JevWitness> {
  if (!provider) return abstainWitness(envelope, 'jev_disabled', now());
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error()); }, timeoutMs); });
    const raw = await Promise.race([provider.evaluate(jevRequest(job), controller.signal), timeout]);
    return validateJevResponse(job, envelope, raw, now());
  } catch { return abstainWitness(envelope, controller.signal.aborted ? 'jev_timeout' : 'jev_provider_failure', now()); }
  finally { clearTimeout(timer); }
}
