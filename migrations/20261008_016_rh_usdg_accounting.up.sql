BEGIN;
DROP INDEX execution_proof_one_authorization_idx;
DROP INDEX execution_proof_one_settlement_idx;
CREATE UNIQUE INDEX execution_proof_one_authorization_idx ON execution_receipts(judgment_id)
  WHERE receipt->'verification'->>'profile' IN ('base_usdc_external.v1','rh_usdg_external.v1');
CREATE UNIQUE INDEX execution_proof_one_settlement_idx ON execution_receipts((receipt->>'settlement_rail'),(receipt->>'settlement_ref'))
  WHERE receipt->'verification'->>'profile' IN ('base_usdc_external.v1','rh_usdg_external.v1');
CREATE TABLE settled_judgment_revenue (
  revenue_id text PRIMARY KEY, judgment_id text NOT NULL UNIQUE REFERENCES judgment_receipts(judgment_id),
  network text NOT NULL CHECK (network IN ('eip155:8453','eip155:4663')), transaction_hash text NOT NULL,
  record jsonb NOT NULL,
  CHECK (record->>'revenue_id'=revenue_id AND record->>'judgment_id'=judgment_id AND record->>'network'=network AND record->>'transaction_hash'=transaction_hash),
  CHECK (record->>'verification'='rpc_finalized_transfer'), UNIQUE(network,transaction_hash)
);
CREATE TABLE recorded_protocol_costs (cost_id text PRIMARY KEY, record jsonb NOT NULL CHECK (record->>'cost_id'=cost_id));
CREATE TRIGGER settled_judgment_revenue_immutable BEFORE UPDATE OR DELETE ON settled_judgment_revenue FOR EACH ROW EXECUTE FUNCTION canonical_receipt_immutable();
CREATE TRIGGER settled_judgment_revenue_no_truncate BEFORE TRUNCATE ON settled_judgment_revenue FOR EACH STATEMENT EXECUTE FUNCTION canonical_receipt_immutable();
CREATE TRIGGER recorded_protocol_costs_immutable BEFORE UPDATE OR DELETE ON recorded_protocol_costs FOR EACH ROW EXECUTE FUNCTION canonical_receipt_immutable();
CREATE TRIGGER recorded_protocol_costs_no_truncate BEFORE TRUNCATE ON recorded_protocol_costs FOR EACH STATEMENT EXECUTE FUNCTION canonical_receipt_immutable();
COMMIT;
