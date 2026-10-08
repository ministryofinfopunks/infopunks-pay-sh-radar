import { HarnessEventSchema, DecisionCostEntrySchema, type DecisionCostEntry } from '../schemas/economicEngine';
import { hashCanonical } from './receiptIntegrityService';
import { createEvaluationService } from './evaluationService';
import { EconomicEngineError, type EconomicJudgmentEngine, type DecisionAttempt } from './economicJudgmentEngine';
import type { EconomicExecutionRecord } from './economicExecutionGate';
import type { z } from 'zod';
type HarnessEvent = z.infer<typeof HarnessEventSchema>;

export function createEconomicPrecedentService(engine: EconomicJudgmentEngine) {
  const { store, receipts, threshold } = engine.options;
  const now = engine.options.now ?? (() => new Date());
  const evaluations = createEvaluationService(receipts, threshold, now);
  return {
    async recordEvent(raw: unknown, principal: string) {
      const event = HarnessEventSchema.parse(raw);
      if (event.principal_id !== principal || Date.parse(event.at) > now().getTime()) throw new EconomicEngineError('trace_principal_or_time_invalid', 400);
      return store.transaction(async tx => {
        if (event.attempt_id) {
          const attempt = await tx.get<DecisionAttempt>('attempt', event.attempt_id);
          if (!attempt || attempt.principal_id !== principal || attempt.job.intent_hash !== event.intent_hash) throw new EconomicEngineError('trace_attempt_scope_invalid');
        }
        if (event.authorization_id) {
          const authorization = await tx.get<NonNullable<DecisionAttempt['authorization']>>('authorization', event.authorization_id);
          if (!authorization || authorization.payload.principal_id !== principal
            || (event.attempt_id && authorization.payload.nonce !== event.attempt_id)) throw new EconomicEngineError('trace_authorization_scope_invalid');
        }
        if (event.execution_id) {
          const execution = await tx.get<EconomicExecutionRecord>('execution', event.execution_id);
          if (!execution || execution.principal_id !== principal || (event.authorization_id && execution.authorization_id !== event.authorization_id)) throw new EconomicEngineError('trace_execution_scope_invalid');
        }
        const duplicate = (await tx.list<HarnessEvent>('trace')).find(e => e.principal_id === principal && e.trace_id === event.trace_id
          && e.run_id === event.run_id && e.sequence === event.sequence);
        if (duplicate && hashCanonical(duplicate) !== hashCanonical(event)) throw new EconomicEngineError('trace_sequence_conflict');
        await tx.put('trace', hashCanonical({ principal, event: event.event_id }), event);
        return event;
      });
    },
    async inspectTrace(principal: string, traceId: string, runId: string) {
      return store.transaction(async tx => {
        const events = (await tx.list<HarnessEvent>('trace')).filter(e => e.principal_id === principal && e.trace_id === traceId && e.run_id === runId).sort((a, b) => a.sequence - b.sequence);
        const missing: number[] = [];
        for (let i = 0; i < events.length; i++) {
          const first = i ? events[i - 1].sequence + 1 : 0;
          for (let gap = first; gap < events[i].sequence && missing.length < 1000; gap++) missing.push(gap);
        }
        const tools = events.filter(e => e.event_type === 'tool_started');
        const seen = new Set<string>(), repeated: string[] = [];
        for (const event of tools) {
          const key = hashCanonical({ tool: event.tool_id, args: event.arguments_hash });
          if (seen.has(key)) repeated.push(event.event_id); seen.add(key);
        }
        const steps = new Set(events.map(e => e.step_id));
        const timeRegressions = events.filter((e, i) => i > 0 && Date.parse(e.at) < Date.parse(events[i - 1].at)).map(e => e.event_id);
        return { events, coverage: !events.length || missing.length || events.some(e => e.parent_step_id && !steps.has(e.parent_step_id)) ? 'incomplete' : 'observed_sequences_complete',
          missing_sequences: missing, timestamp_regressions: timeRegressions, repeated_tool_events: repeated, error_events: events.filter(e => e.event_type === 'error').map(e => e.event_id),
          reputation_authority: false, economic_surplus: 'unmeasured' };
      });
    },
    async evaluateExecution(executionId: string, verifyTaskOutcome: (record: EconomicExecutionRecord) => Promise<{ outcome: 'confirmed' | 'weakened' | 'contradicted'; evidence_refs: string[] } | null>) {
      const record = await store.transaction(tx => tx.get<EconomicExecutionRecord>('execution', executionId));
      if (!record?.receipt || record.state !== 'finalized') throw new EconomicEngineError('evaluation_requires_finalized_execution');
      const verified = await verifyTaskOutcome(structuredClone(record));
      if (!verified || !verified.evidence_refs.length) throw new EconomicEngineError('evaluation_outcome_unproven');
      const evaluationId = 'economic_evaluation_' + hashCanonical({ execution: executionId }).slice(7);
      const inputHash = hashCanonical(verified);
      const prior = await store.transaction(tx => tx.get<{ input_hash: string; evaluated_at: string }>('evaluation', evaluationId));
      if (prior && prior.input_hash !== inputHash) throw new EconomicEngineError('evaluation_outcome_conflict');
      const evaluatedAt = prior?.evaluated_at ?? now().toISOString();
      // Freeze the result before canonical publication so restart retries use the same timestamp.
      await store.transaction(async tx => {
        const raced = await tx.get<{ input_hash: string; evaluated_at: string }>('evaluation', evaluationId);
        if (raced && raced.input_hash !== inputHash) throw new EconomicEngineError('evaluation_outcome_conflict');
        if (!raced) await tx.put('evaluation', evaluationId, { input_hash: inputHash, evaluated_at: evaluatedAt });
      });
      const frozen = await store.transaction(tx => tx.get<{ evaluated_at: string }>('evaluation', evaluationId));
      return evaluations.createEvaluation({ evaluation_id: evaluationId, execution_id: executionId, evaluated_at: frozen!.evaluated_at,
        outcome: verified.outcome, reasons: ['independently_verified_execution_outcome'], evidence_refs: verified.evidence_refs });
    },
    async recordCost(raw: unknown, verifyCost: (entry: DecisionCostEntry) => Promise<boolean>) {
      const entry = DecisionCostEntrySchema.parse(raw);
      if (entry.amount_atomic !== null && !await verifyCost(entry)) throw new EconomicEngineError('cost_provenance_unverified');
      return store.transaction(async tx => {
        const attempt = await tx.get<DecisionAttempt>('attempt', entry.attempt_id);
        if (!attempt) throw new EconomicEngineError('attempt_not_found', 404);
        if (entry.resolves_entry_id) {
          const prior = await tx.get<DecisionCostEntry>('cost', entry.resolves_entry_id);
          if (!prior || prior.amount_atomic !== null || prior.attempt_id !== entry.attempt_id || prior.category !== entry.category
            || prior.asset_id !== entry.asset_id || entry.amount_atomic === null) throw new EconomicEngineError('cost_resolution_invalid');
          if ((await tx.list<DecisionCostEntry>('cost')).some(e => e.entry_id !== entry.entry_id && e.resolves_entry_id === prior.entry_id)) throw new EconomicEngineError('cost_already_resolved');
        }
        if (entry.category === 'settled_fee') {
          const reused = (await tx.list<DecisionCostEntry>('cost')).some(e => e.entry_id !== entry.entry_id && e.category === 'settled_fee'
            && e.asset_id === entry.asset_id && e.settlement_ref === entry.settlement_ref);
          if (reused) throw new EconomicEngineError('revenue_settlement_reused');
        }
        await tx.put('cost', entry.entry_id, entry); return entry;
      });
    },
    async economics(attemptId: string, assetId: string) {
      return store.transaction(async tx => {
        const entries = (await tx.list<DecisionCostEntry>('cost')).filter(e => e.attempt_id === attemptId);
        const resolved = new Set(entries.flatMap(e => e.resolves_entry_id ? [e.resolves_entry_id] : []));
        const effective = entries.filter(e => !resolved.has(e.entry_id));
        const scoped = effective.filter(e => e.asset_id === assetId);
        const required = ['refund', 'inference', 'verification', 'payment_fee', 'gas', 'reconciliation'];
        const complete = required.every(category => effective.some(e => e.category === category))
          && effective.every(e => e.amount_atomic !== null && e.asset_id === assetId);
        const revenue = scoped.filter(e => e.category === 'settled_fee').reduce((sum, e) => sum + BigInt(e.amount_atomic ?? '0'), 0n);
        const costs = scoped.filter(e => e.category !== 'settled_fee').reduce((sum, e) => sum + BigInt(e.amount_atomic ?? '0'), 0n);
        return { attempt_id: attemptId, asset_id: assetId, entries, settled_revenue_atomic: revenue.toString(),
          known_variable_costs_atomic: costs.toString(), contribution_margin_atomic: complete ? (revenue - costs).toString() : null,
          cost_coverage: complete ? 'recorded_entries_complete' : 'unknown_or_mixed_asset_costs', distributable_surplus: null, treasury_execution_enabled: false };
      });
    },
    async summary() {
      return store.transaction(async tx => {
        const attempts = await tx.list<DecisionAttempt>('attempt');
        const executions = await tx.list<EconomicExecutionRecord>('execution');
        const costs = await tx.list<DecisionCostEntry>('cost');
        return { attempts: attempts.length, abstentions: attempts.filter(a => a.witness?.answer.kind === 'abstain').length,
          jev_inference_calls: costs.filter(c => c.entry_id.startsWith('inference_attempt_')).length,
          unknown_inference_costs: costs.filter(c => c.category === 'inference' && c.amount_atomic === null
            && !costs.some(resolution => resolution.resolves_entry_id === c.entry_id)).length,
          dissent: attempts.filter(a => a.result?.dissent).length, vetoes: attempts.filter(a => a.result?.verdict === 'BLOCK').length,
          capabilities_issued: attempts.filter(a => a.authorization).length, finalized_executions: executions.filter(e => e.state === 'finalized').length,
          reconciliation_required: executions.filter(e => e.state !== 'finalized').length, reputation_authority: 'canonical_evaluation_receipts_only' };
      });
    }
  };
}
