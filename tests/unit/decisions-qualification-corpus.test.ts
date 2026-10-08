import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { CanonicalDecisionSchema } from '../../src/schemas/preSpend';
import { request, setupJudgment } from '../helpers/judgments';

const category = z.enum(['valid_approval', 'insufficient_evidence', 'provider_mismatch', 'stale_observation', 'manipulated_input', 'denied_action']);
const corpusSchema = z.object({
  schema_version: z.literal('decisions-qualification-corpus.v1'),
  label_method: z.literal('deterministic_policy_replay'),
  reviewer_status: z.literal('pending_external_review'),
  source_checkpoint: z.literal('62380c06d9098e7e09f09dc6ffc620fe906e0f8b'),
  fixed_clock: z.literal('2026-10-07T00:00:02Z'),
  limitations: z.array(z.string().min(1)).min(1),
  cases: z.array(z.object({
    id: z.string().regex(/^[a-z0-9_]+$/), category, description: z.string().min(1),
    provenance: z.object({ source_files: z.array(z.string().min(1)).min(1), rule_ids: z.array(z.string().min(1)).min(1) }).strict(),
    overrides: z.object({ policy: z.record(z.string(), z.unknown()).optional(), observation: z.record(z.string(), z.unknown()).optional(), legacy: z.record(z.string(), z.unknown()).optional() }).strict(),
    expected: z.object({ decision: CanonicalDecisionSchema, production_shadow_eligible: z.boolean(), payment_required: z.boolean() }).strict(),
    challenge_text: z.string().min(1)
  }).strict()).min(1)
}).strict();

const corpus = corpusSchema.parse(JSON.parse(readFileSync(new URL('../fixtures/decisions-qualification-cases.json', import.meta.url), 'utf8')));

describe('Decisions qualification corpus', () => {
  it('has unique, source-backed, provider-independent labels in every required category', () => {
    expect(new Set(corpus.cases.map(item => item.id)).size).toBe(corpus.cases.length);
    expect(new Set(corpus.cases.map(item => item.category))).toEqual(new Set(category.options));
    for (const item of corpus.cases) {
      for (const source of item.provenance.source_files) expect(existsSync(resolve(process.cwd(), source)), `${item.id}: ${source}`).toBe(true);
      expect(item).not.toHaveProperty('mock_decision');
      expect(item).not.toHaveProperty('provider_decision');
      expect(item.expected.payment_required).toBe(item.expected.decision !== 'insufficient_evidence');
    }
  });

  it.each(corpus.cases)('$id replays to its predeclared label and respects the shadow gate', async item => {
    const shadow = vi.fn(async () => undefined);
    const fixture = await setupJudgment(item.overrides.policy, item.overrides.observation, item.overrides.legacy, shadow);
    const result = await fixture.service.check(request);
    expect(result.response.decision).toBe(item.expected.decision);
    expect(result.response.payment_required).toBe(item.expected.payment_required);
    expect(result.status).toBe(item.expected.payment_required ? 402 : 200);
    expect(shadow).toHaveBeenCalledTimes(item.expected.production_shadow_eligible ? 1 : 0);
    expect(await fixture.store.list('judgment')).toHaveLength(0);
    expect(fixture.facilitator.verify).not.toHaveBeenCalled();
    expect(fixture.facilitator.settle).not.toHaveBeenCalled();
    if (!item.expected.payment_required) {
      expect(result.response.cost.amount).toBe('0');
      expect(result.response.receipt).toBeNull();
      expect(result.headers).not.toHaveProperty('PAYMENT-REQUIRED');
    }
  });
});
