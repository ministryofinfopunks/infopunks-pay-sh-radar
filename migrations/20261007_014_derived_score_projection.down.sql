begin;
-- Rollback deliberately refuses if V1 receipts exist: immutable history must not be rewritten.
alter table evaluation_receipts drop constraint evaluation_score_policy_valid;
alter table evaluation_receipts add constraint evaluation_legacy_policy_valid check (receipt->>'policy_version'='receipt-authority.v1');
alter table evaluation_receipts add constraint evaluation_legacy_delta_valid check (
  (receipt->>'score_delta')::numeric = case receipt->>'outcome' when 'confirmed' then 5 when 'weakened' then -2 when 'contradicted' then -5 end
);
commit;
