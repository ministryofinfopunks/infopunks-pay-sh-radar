begin;
do $$ begin
  if exists (select 1 from decision_contexts limit 1) or exists (
    select 1 from judgment_receipts where receipt->>'schema_version'='canonical-receipts.v2' limit 1
  ) then raise exception 'refusing to remove decision context history'; end if;
end $$;
drop trigger canonical_judgment_context on judgment_receipts;
drop function canonical_judgment_context_valid();
alter table judgment_receipts drop constraint judgment_receipt_version_context_check;
alter table judgment_receipts add constraint judgment_receipt_v1_only check (receipt->>'schema_version'='canonical-receipts.v1');
drop table decision_contexts;
commit;
