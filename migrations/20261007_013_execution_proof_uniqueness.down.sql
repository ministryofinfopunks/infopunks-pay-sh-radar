DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM execution_receipts WHERE receipt->'verification'->>'profile' = 'base_usdc_external.v1' LIMIT 1) THEN
    RAISE EXCEPTION 'refusing to remove execution authority protections after proof intake';
  END IF;
END $$;
DROP INDEX IF EXISTS execution_proof_one_authorization_idx;
DROP INDEX IF EXISTS execution_proof_one_settlement_idx;
