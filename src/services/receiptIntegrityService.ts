import { createHash } from 'node:crypto';
import { ObservationReceiptSchema, JudgmentReceiptSchema, ExecutionReceiptSchema, EvaluationReceiptSchema, type ReceiptKind } from '../schemas/receipts';
export const receiptSchemas = { observation: ObservationReceiptSchema, judgment: JudgmentReceiptSchema, execution: ExecutionReceiptSchema, evaluation: EvaluationReceiptSchema };

/** JSON-only, recursive lexical key order; arrays retain their semantic order. */
export function canonicalSerialize(value: unknown): string {
  const ancestors = new Set<object>();
  function encode(item: unknown): string {
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== 'object' || !item || ancestors.has(item)) throw new Error('non_canonical_json');
    if (!Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) throw new Error('non_canonical_json');
    ancestors.add(item);
    try {
      return Array.isArray(item) ? '[' + Array.from(item, encode).join(',') + ']'
        : '{' + Object.keys(item).sort().map((key) => JSON.stringify(key) + ':' + encode((item as Record<string, unknown>)[key])).join(',') + '}';
    } finally { ancestors.delete(item); }
  }
  return encode(value);
}
export function hashCanonical(value: unknown): string {
  return 'sha256:' + createHash('sha256').update(canonicalSerialize(value)).digest('hex');
}
export function computeReceiptHash(kind: ReceiptKind, receipt: Record<string, unknown>): string {
  const { receipt_hash: ignored, ...payload } = receipt;
  return hashCanonical({ kind, payload });
}
export function verifyReceiptIntegrity(kind: ReceiptKind, raw: unknown): boolean {
  const parsed = receiptSchemas[kind].safeParse(raw);
  if (!parsed.success) return false;
  const receipt = parsed.data;
  return receipt.receipt_hash === computeReceiptHash(kind, receipt)
    && (kind !== 'observation' || ('payload' in receipt && receipt.payload_hash === hashCanonical(receipt.payload)));
}
export function sealReceipt<T extends Record<string, unknown>>(kind: ReceiptKind, payload: T): T & { receipt_hash: string } {
  return { ...payload, receipt_hash: computeReceiptHash(kind, payload) };
}
