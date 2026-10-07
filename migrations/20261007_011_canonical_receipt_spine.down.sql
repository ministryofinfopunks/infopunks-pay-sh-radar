-- Roll back application first. This reversal refuses to discard durable receipts.
begin;
do $$ begin
  if exists (select 1 from observation_receipts) or exists (select 1 from judgment_receipts)
     or exists (select 1 from execution_receipts) or exists (select 1 from evaluation_receipts)
  then raise exception 'canonical_receipt_rollback_has_durable_memory'; end if;
end $$;
drop table judgment_observations;
drop table evaluation_receipts;
drop table execution_receipts;
drop table judgment_receipts;
drop table observation_receipts;
drop function canonical_judgment_links_valid();
drop function canonical_receipt_immutable();
commit;
