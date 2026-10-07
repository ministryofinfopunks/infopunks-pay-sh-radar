CREATE UNIQUE INDEX IF NOT EXISTS execution_proof_one_authorization_idx ON execution_receipts(judgment_id)
  WHERE receipt->'verification'->>'profile' = 'base_usdc_external.v1';
CREATE UNIQUE INDEX IF NOT EXISTS execution_proof_one_settlement_idx ON execution_receipts((receipt->>'settlement_rail'), (receipt->>'settlement_ref'))
  WHERE receipt->'verification'->>'profile' = 'base_usdc_external.v1';
