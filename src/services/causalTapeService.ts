import type { JudgmentRequestRepository } from '../repositories/judgmentRequestRepository';
import type { ReceiptKind } from '../schemas/receipts';
import { hashCanonical } from './receiptIntegrityService';
import { verifyReceiptChain, type ReceiptAppendStore, type ReceiptRecord } from './receiptAuthorityService';

const kinds = ['observation', 'judgment', 'execution', 'evaluation'] as const;
const ids = { observation: 'observation_id', judgment: 'judgment_id', execution: 'execution_id', evaluation: 'evaluation_id' } as const;
type TapeItem = { kind: ReceiptKind; id: string; receipt: ReceiptRecord; acceptance: { sequence: number; accepted_at: string } | null;
  ancestry_valid: boolean; label: 'qualified' | 'inspectable_nonqualifying' | 'historical_unsequenced' };

export function createCausalTapeService(store: ReceiptAppendStore, journal: JudgmentRequestRepository) {
  async function closure(kind: ReceiptKind, receipt: ReceiptRecord): Promise<Array<{ kind: ReceiptKind; receipt: ReceiptRecord; decision_context?: Awaited<ReturnType<NonNullable<ReceiptAppendStore['getDecisionContext']>>> }>> {
    const result: Array<{ kind: ReceiptKind; receipt: ReceiptRecord; decision_context?: Awaited<ReturnType<NonNullable<ReceiptAppendStore['getDecisionContext']>>> }> = [];
    const seen = new Set<string>();
    async function visit(nextKind: ReceiptKind, next: ReceiptRecord) {
      const id = String((next as unknown as Record<string, unknown>)[ids[nextKind]]);
      if (seen.has(nextKind + ':' + id)) return;
      seen.add(nextKind + ':' + id);
      if (nextKind === 'evaluation' && 'execution_id' in next) {
        const parent = await store.get('execution', next.execution_id);
        if (parent) await visit('execution', parent);
      } else if (nextKind === 'execution' && 'judgment_id' in next) {
        const parent = await store.get('judgment', next.judgment_id);
        if (parent) await visit('judgment', parent);
      } else if (nextKind === 'judgment' && 'cited_observation_ids' in next) {
        for (const observationId of next.cited_observation_ids) {
          const parent = await store.get('observation', observationId);
          if (parent) await visit('observation', parent);
        }
        const context = await store.getDecisionContext?.(next.judgment_id);
        if (context) for (const ref of context.evaluation_refs) {
          const parent = await store.get('evaluation', ref.evaluation_id);
          if (parent) await visit('evaluation', parent);
        }
      }
      result.push({ kind: nextKind, receipt: next,
        ...(nextKind === 'judgment' && 'judgment_id' in next ? { decision_context: await store.getDecisionContext?.(next.judgment_id) ?? null } : {}) });
    }
    await visit(kind, receipt);
    return result;
  }
  async function snapshot(acceptedThrough?: number) {
    const boundary = await store.acceptanceBoundary?.();
    if (!boundary) throw new Error('acceptance_boundary_unavailable');
    const sequence = acceptedThrough ?? boundary.sequence;
    if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence > boundary.sequence) throw new Error('invalid_tape_boundary');
    const raw = await Promise.all(kinds.map(async kind => ({ kind, receipts: await store.list(kind) })));
    const all: TapeItem[] = [];
    for (const group of raw) for (const receipt of group.receipts) {
      const id = String((receipt as unknown as Record<string, unknown>)[ids[group.kind]]);
      const acceptance = await store.getAcceptance?.(group.kind, id) ?? null;
      if (acceptance && acceptance.sequence > sequence) continue;
      const ancestryValid = await verifyReceiptChain(group.kind, receipt, store);
      const parent = group.kind === 'evaluation' && 'execution_id' in receipt ? await store.get('execution', receipt.execution_id) : null;
      const qualified = group.kind === 'evaluation' && 'classification' in receipt && Boolean(receipt.classification)
        && ancestryValid && parent !== null && 'score_eligibility' in parent && parent.score_eligibility?.state === 'qualifying';
      all.push({ kind: group.kind, id, receipt, acceptance, ancestry_valid: ancestryValid,
        label: !acceptance ? 'historical_unsequenced' : qualified ? 'qualified' : 'inspectable_nonqualifying' });
    }
    all.sort((a,b) => (a.acceptance?.sequence ?? 0) - (b.acceptance?.sequence ?? 0) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
    const freeAttempts = await journal.listFreeAttempts?.() ?? [];
    const quarantine = await store.listQuarantine?.() ?? [];
    const manifest = { version: 'ipx-causal-tape.v1', accepted_through: sequence,
      receipt_refs: all.map(item => ({ kind: item.kind, id: item.id, receipt_hash: item.receipt.receipt_hash,
        acceptance_sequence: item.acceptance?.sequence ?? null })),
      free_attempt_hashes: freeAttempts.map(item => item.attempt_hash).sort(),
      quarantine_refs: quarantine.map(item => ({ kind: item.receipt_kind, id: item.receipt_id, receipt_hash: item.receipt_hash, reason: item.reason })) };
    return { all, freeAttempts, quarantine, manifest: { ...manifest, manifest_hash: hashCanonical(manifest) } };
  }
  return {
    closure,
    async page(options: { acceptedThrough?: number; cursor?: number; limit?: number; kind?: ReceiptKind }) {
      const { all, freeAttempts, quarantine, manifest } = await snapshot(options.acceptedThrough);
      const filtered = options.kind ? all.filter(item => item.kind === options.kind) : all;
      const offset = options.cursor ?? 0, limit = options.limit ?? 50;
      if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('invalid_tape_pagination');
      const page = await Promise.all(filtered.slice(offset, offset + limit).map(async item => ({ ...item, parent_closure: await closure(item.kind, item.receipt) })));
      return { manifest, items: page, next_cursor: offset + limit < filtered.length ? String(offset + limit) : null,
        free_assessment_attempts: freeAttempts.slice(0, 100), free_attempt_next_cursor: freeAttempts.length > 100 ? '100' : null,
        quarantined_receipts: quarantine.slice(0, 100), quarantine_count: quarantine.length,
        counters: { ancestry_complete: all.filter(item => item.ancestry_valid).length,
          verified_causal_revision: 0, independently_measured_improvement: 0 },
        coverage: { listed_receipts: filtered.length, free_attempts: freeAttempts.length, real_route_verified: false } };
    },
    async attemptPage(cursor = 0, limit = 50) {
      if (!Number.isSafeInteger(cursor) || cursor < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('invalid_tape_pagination');
      const { freeAttempts, manifest } = await snapshot();
      return { manifest_hash: manifest.manifest_hash, items: freeAttempts.slice(cursor, cursor + limit),
        next_cursor: cursor + limit < freeAttempts.length ? String(cursor + limit) : null };
    }
  };
}
