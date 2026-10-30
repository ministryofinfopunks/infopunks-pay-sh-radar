begin;
-- Qualifying execution identity is one finalized external settlement per network.
-- Internal, historical and synthetic receipts remain stored but cannot enter the projection.
create unique index execution_qualifying_settlement_once_idx on execution_receipts
  ((receipt->'verification'->'settlement'->>'network'), (receipt->'verification'->'settlement'->>'transaction_hash'))
  where receipt->'score_eligibility'->>'state' = 'qualifying'
    and receipt->'score_eligibility'->>'intake' = 'external_proof_gateway.v1';
create unique index execution_qualifying_judgment_once_idx on execution_receipts (judgment_id)
  where receipt->'score_eligibility'->>'state' = 'qualifying'
    and receipt->'score_eligibility'->>'intake' = 'external_proof_gateway.v1';
commit;
