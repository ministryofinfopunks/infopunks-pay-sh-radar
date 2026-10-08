begin;
-- Replace Phase 1's hardcoded policy guards while preserving historical receipts.
do $$ declare item record; begin
  for item in select conname from pg_constraint where conrelid='evaluation_receipts'::regclass
    and contype='c' and (pg_get_constraintdef(oid) like '%policy_version%' or pg_get_constraintdef(oid) like '%score_delta%')
  loop execute format('alter table evaluation_receipts drop constraint %I', item.conname); end loop;
end $$;
alter table evaluation_receipts add constraint evaluation_score_policy_valid check ((
  (receipt->>'policy_version'='receipt-authority.v1' and
    (receipt->>'score_delta')::numeric = case receipt->>'outcome' when 'confirmed' then 5 when 'weakened' then -2 when 'contradicted' then -5 end)
  or (receipt->>'policy_version'='score-policy.v1' and
    (receipt->>'score_delta')::numeric = case receipt->>'outcome' when 'confirmed' then 5 when 'weakened' then -2 when 'contradicted' then -15 end
    and receipt->'evaluator'->>'verification'='internal' and receipt->'evaluator'->>'type'='internal'
    and receipt->'evaluator'->>'id' in ('canonical-admin','evaluation-service'))
) is true);
-- Existing subject, execution-parent, and unique evaluation-parent indexes support the graph join.
-- No independently writable reputation table, cache, or backfill is required.
commit;
