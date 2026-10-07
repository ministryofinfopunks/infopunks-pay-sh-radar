-- Operational journal, separate from append-only authoritative receipts.
CREATE TABLE IF NOT EXISTS judgment_requests (
  request_key text PRIMARY KEY,
  request_hash text NOT NULL,
  state text NOT NULL CHECK (state IN ('quoted','settling','settled','complete')),
  payment_hash text UNIQUE,
  settlement_ref text UNIQUE,
  record jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS observation_receipts_judgment_scope_idx
  ON observation_receipts(subject_id, (receipt->>'intent_hash'), observed_at DESC);
