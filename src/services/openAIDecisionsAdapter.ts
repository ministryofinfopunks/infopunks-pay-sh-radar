import { z } from 'zod';

export const OPENAI_DECISIONS_ADAPTER_VERSION = 'openai-decisions-adapter.v1' as const;
export const OPENAI_DECISIONS_MODEL = 'gpt-6-luna' as const;
const ENDPOINT = 'https://api.openai.com/v1/decisions';
const probability = z.number().finite().min(0).max(1);
const value = z.union([z.string(), z.boolean()]);
const questionName = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);

const PredicateQuestion = z.object({ type: z.literal('predicate'), name: questionName, instructions: z.string().min(1).max(4096) }).strict();
const ChoiceQuestion = z.object({ type: z.literal('choice'), name: questionName, instructions: z.string().min(1).max(4096), choices: z.array(z.object({ value, description: z.string().max(512).optional() }).strict()).min(2).max(255) }).strict();
const ScoreQuestion = z.object({ type: z.literal('score'), name: questionName, instructions: z.string().min(1).max(4096), levels: z.array(z.object({ label: z.string().min(1).max(128), description: z.string().max(512).optional() }).strict()).min(2).max(255) }).strict();
export const DecisionsQuestionSchema = z.discriminatedUnion('type', [PredicateQuestion, ChoiceQuestion, ScoreQuestion]);
export type DecisionsQuestion = z.infer<typeof DecisionsQuestionSchema>;
export const DecisionsEvaluationRequestSchema = z.object({
  input: z.string().min(1).max(16_384), questions: z.array(DecisionsQuestionSchema).min(1).max(8),
  safety_identifier: z.string().min(1).max(128).optional()
}).strict();
export type DecisionsEvaluationRequest = z.infer<typeof DecisionsEvaluationRequestSchema>;

const UsageSchema = z.object({ input_tokens: z.number().int().nonnegative(), output_tokens: z.number().int().nonnegative(), total_tokens: z.number().int().nonnegative(),
  input_tokens_details: z.object({ cached_tokens: z.number().int().nonnegative().optional(), cache_write_tokens: z.number().int().nonnegative().optional() }).passthrough().optional(),
  output_tokens_details: z.object({ reasoning_tokens: z.number().int().nonnegative().optional() }).passthrough().optional()
}).passthrough();
export type DecisionsUsage = z.infer<typeof UsageSchema>;
const AnswerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('predicate'), name: questionName.nullable(), probability }).passthrough(),
  z.object({ type: z.literal('choice'), name: questionName.nullable(), choice: value, confidence: probability, probabilities: z.array(z.object({ value, probability }).passthrough()) }).passthrough(),
  z.object({ type: z.literal('score'), name: questionName.nullable(), score: z.number().finite(), confidence: probability, probabilities: z.array(z.object({ value: z.number().int().nonnegative(), label: z.string(), probability }).passthrough()) }).passthrough(),
  z.object({ type: z.literal('refusal'), name: questionName.nullable() }).passthrough()
]);
const ResponseSchema = z.object({ model: z.string(), answers: z.array(AnswerSchema), usage: UsageSchema }).passthrough();
export type NormalizedAnswer =
  | { type: 'predicate'; name: string; probability: number; confidence: number }
  | { type: 'choice'; name: string; choice: string | boolean; confidence: number; probabilities: Array<{ value: string | boolean; probability: number }> }
  | { type: 'score'; name: string; score: number; confidence: number; probabilities: Array<{ value: number; label: string; probability: number }> }
  | { type: 'refusal'; name: string };
export type DecisionsFailure = 'invalid_request' | 'refusal' | 'malformed_response' | 'missing_confidence' | 'timeout' | 'rate_limited' | 'provider_unavailable' | 'authentication' | 'quota_exhausted';
export type DecisionsAccountingEvent = {
  event: 'decisions_provider_attempt'; adapter_version: typeof OPENAI_DECISIONS_ADAPTER_VERSION; model: typeof OPENAI_DECISIONS_MODEL;
  request_hash?: string; status: 'ok' | 'refused' | 'failed'; failure: DecisionsFailure | null; latency_ms: number;
  attempts: number; input_tokens: number | null; output_tokens: number | null; total_tokens: number | null;
  baseline_estimated_cost_usd: number | null; actual_provider_cost_usd: null; billable_decision_receipt: false;
};
export type DecisionsResult = {
  adapter_version: typeof OPENAI_DECISIONS_ADAPTER_VERSION; model: typeof OPENAI_DECISIONS_MODEL;
  status: 'ok' | 'refused' | 'failed'; failure: DecisionsFailure | null; answers: NormalizedAnswer[];
  usage: DecisionsUsage | null; accounting: DecisionsAccountingEvent;
};
export type DecisionsAdapterOptions = { apiKey: string; timeoutMs?: number; fetch?: typeof globalThis.fetch; now?: () => number; onAccounting?: (event: DecisionsAccountingEvent) => void };

function sameValue(a: string | boolean, b: string | boolean) { return typeof a === typeof b && a === b; }
function validDistribution(values: number[]) { return values.length > 0 && Math.abs(values.reduce((sum, p) => sum + p, 0) - 1) <= 0.02; }
function normalize(question: DecisionsQuestion, raw: z.infer<typeof AnswerSchema>): NormalizedAnswer | DecisionsFailure {
  if (raw.name !== question.name) return 'malformed_response';
  if (raw.type === 'refusal') return { type: 'refusal', name: question.name };
  if (raw.type !== question.type) return 'malformed_response';
  if (question.type === 'predicate' && raw.type === 'predicate') return { type: 'predicate', name: question.name, probability: raw.probability, confidence: raw.probability };
  if (question.type === 'choice' && raw.type === 'choice') {
    if (raw.probabilities.length !== question.choices.length || !validDistribution(raw.probabilities.map(p => p.probability)) ||
      question.choices.some(q => raw.probabilities.filter(p => sameValue(p.value, q.value)).length !== 1) ||
      !question.choices.some(q => sameValue(q.value, raw.choice))) return 'malformed_response';
    return { type: 'choice', name: question.name, choice: raw.choice, confidence: raw.confidence, probabilities: raw.probabilities };
  }
  if (question.type === 'score' && raw.type === 'score') {
    if (raw.score < 0 || raw.score > question.levels.length - 1 || raw.probabilities.length !== question.levels.length ||
      !validDistribution(raw.probabilities.map(p => p.probability)) || question.levels.some((level, i) => raw.probabilities.filter(p => p.value === i && p.label === level.label).length !== 1) ||
      Math.abs(raw.score - raw.probabilities.reduce((sum, p) => sum + p.value * p.probability, 0)) > 0.02) return 'malformed_response';
    return { type: 'score', name: question.name, score: raw.score, confidence: raw.confidence, probabilities: raw.probabilities };
  }
  return 'malformed_response';
}

function classifyHttp(status: number, code?: string): DecisionsFailure {
  if (status === 401 || status === 403) return 'authentication';
  if (['credit_balance_exhausted', 'organization_spend_limit_exceeded', 'project_spend_limit_exceeded', 'organization_usage_limit_exceeded'].includes(code ?? '')) return 'quota_exhausted';
  if (status === 429) return 'rate_limited';
  return 'provider_unavailable';
}

/** Provider output is an advisory signal. This class has no receipt, budget, signing or settlement dependency. */
export class OpenAIDecisionsAdapter {
  readonly version = OPENAI_DECISIONS_ADAPTER_VERSION;
  constructor(private readonly options: DecisionsAdapterOptions) { if (!options.apiKey) throw new Error('decisions_api_key_missing'); }

  async evaluate(rawRequest: DecisionsEvaluationRequest, requestHash?: string): Promise<DecisionsResult> {
    const clock = this.options.now ?? (() => performance.now());
    const started = clock();
    const parsed = DecisionsEvaluationRequestSchema.safeParse(rawRequest);
    const request = parsed.success ? parsed.data : null;
    let failure: DecisionsFailure | null = request ? null : 'invalid_request';
    let answers: NormalizedAnswer[] = [];
    let usage: DecisionsUsage | null = null;
    let attempts = 0;
    if (request) {
      const names = request.questions.map(q => q.name);
      if (new Set(names).size !== names.length || request.questions.some(q => q.type === 'choice' && new Set(q.choices.map(c => `${typeof c.value}:${String(c.value)}`)).size !== q.choices.length)) failure = 'invalid_request';
    }
    if (request && !failure) {
      const controller = new AbortController();
      const timeoutMs = Math.max(1, Math.min(this.options.timeoutMs ?? 1200, 10_000));
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await (this.options.fetch ?? globalThis.fetch)(ENDPOINT, {
          method: 'POST', headers: { Authorization: `Bearer ${this.options.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: OPENAI_DECISIONS_MODEL, input: request.input, questions: request.questions, ...(request.safety_identifier ? { safety_identifier: request.safety_identifier } : {}) }),
          signal: controller.signal
        });
        attempts = 1;
        if (!response.ok) {
          let code: string | undefined;
          try { const body = await response.json() as { error?: { code?: string } }; code = body.error?.code; } catch { /* status still classifies the failure */ }
          failure = classifyHttp(response.status, code);
        } else {
          const json: unknown = await response.json().catch(() => null);
          const candidateUsage = UsageSchema.safeParse(json && typeof json === 'object' && 'usage' in json ? json.usage : undefined);
          if (candidateUsage.success) usage = candidateUsage.data;
          const result = ResponseSchema.safeParse(json);
          if (!result.success) {
            failure = result.error.issues.some(issue => issue.path.at(-1) === 'confidence') ? 'missing_confidence' : 'malformed_response';
          } else if (result.data.model !== OPENAI_DECISIONS_MODEL || result.data.answers.length !== request.questions.length) {
            failure = 'malformed_response';
          } else {
            for (const [index, answer] of result.data.answers.entries()) {
              const normalized = normalize(request.questions[index], answer);
              if (typeof normalized === 'string') { failure = normalized; answers = []; break; }
              answers.push(normalized);
            }
            if (!failure && answers.some(answer => answer.type === 'refusal')) failure = 'refusal';
          }
        }
        if (controller.signal.aborted) { failure = 'timeout'; answers = []; }
      } catch (error) {
        attempts = 1;
        failure = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError') ? 'timeout' : 'provider_unavailable';
      } finally { clearTimeout(timer); }
    }
    const status = failure === null ? 'ok' : failure === 'refusal' ? 'refused' : 'failed';
    const accounting: DecisionsAccountingEvent = {
      event: 'decisions_provider_attempt', adapter_version: this.version, model: OPENAI_DECISIONS_MODEL,
      ...(requestHash ? { request_hash: requestHash } : {}), status, failure, latency_ms: Math.max(0, clock() - started), attempts,
      input_tokens: usage?.input_tokens ?? null, output_tokens: usage?.output_tokens ?? null, total_tokens: usage?.total_tokens ?? null,
      // Public-beta endpoint baseline only; regional/long-context multipliers make actual cost unknown.
      baseline_estimated_cost_usd: usage ? Math.max(0, usage.input_tokens - (usage.input_tokens_details?.cached_tokens ?? 0) - (usage.input_tokens_details?.cache_write_tokens ?? 0)) * 0.10 / 1_000_000 : null,
      actual_provider_cost_usd: null, billable_decision_receipt: false
    };
    try { this.options.onAccounting?.(accounting); } catch { /* telemetry cannot affect policy */ }
    return { adapter_version: this.version, model: OPENAI_DECISIONS_MODEL, status, failure, answers, usage, accounting };
  }
}
