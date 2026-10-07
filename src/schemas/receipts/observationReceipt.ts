import { z } from 'zod';
import { ReceiptIdSchema as id, ReceiptHashSchema as hash, ReceiptTimeSchema as time, ReceiptVersionSchema } from './common';
export const ObservationReceiptSchema = z.object({
  schema_version: ReceiptVersionSchema,
  observation_id: id, subject_type: id, subject_id: id, intent_hash: hash,
  source_type: id, source_id: id, observed_at: time, ingested_at: time,
  freshness_expires_at: time.nullable(),
  evidence_state: z.enum(['sufficient', 'insufficient', 'stale', 'disputed']),
  evidence_refs: z.array(id), provenance: z.record(z.string(), z.json()),
  payload: z.json(), payload_hash: hash, receipt_hash: hash
}).strict().refine((value) => Date.parse(value.observed_at) <= Date.parse(value.ingested_at), 'observation_after_ingestion');
export type ObservationReceipt = z.infer<typeof ObservationReceiptSchema>;
