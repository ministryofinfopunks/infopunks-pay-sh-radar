begin;
do $$ begin
  if exists (select 1 from canonical_receipt_acceptances limit 1) or exists (select 1 from canonical_receipt_quarantine limit 1)
     or exists (select 1 from decision_contexts where context->>'version'='pre-spend-decision-context.v2' limit 1)
  then raise exception 'receipt acceptance history must not be discarded'; end if;
end $$;
alter table decision_contexts drop constraint decision_contexts_version_check;
alter table decision_contexts add constraint decision_contexts_context_check1 check (context->>'version'='pre-spend-decision-context.v1');
drop table canonical_receipt_quarantine;
drop table canonical_receipt_acceptances;
commit;
