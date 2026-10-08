begin;
-- Existing receipts predate acceptance history. Give each a stable position before
-- publishing the first tape manifest after this migration.
insert into canonical_receipt_acceptances(receipt_kind, receipt_id, receipt_hash)
select kind, id, receipt_hash from (
  select 'observation' as kind, observation_id as id, receipt_hash, observed_at as event_at from observation_receipts
  union all select 'judgment', judgment_id, receipt_hash, issued_at from judgment_receipts
  union all select 'execution', execution_id, receipt_hash, executed_at from execution_receipts
  union all select 'evaluation', evaluation_id, receipt_hash, evaluated_at from evaluation_receipts
) receipts
order by event_at, kind, id
on conflict(receipt_kind, receipt_id) do nothing;

-- These two append-only streams have their own monotone publication positions.
-- A composite boundary can then replay a manifest even after either stream grows.
alter table free_assessment_attempts add column publication_sequence bigserial unique;
alter table canonical_receipt_quarantine add column publication_sequence bigserial unique;
commit;
