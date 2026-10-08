begin;
do $$ begin
  if exists (select 1 from canonical_receipt_acceptances limit 1)
     or exists (select 1 from free_assessment_attempts limit 1)
     or exists (select 1 from canonical_receipt_quarantine limit 1)
  then raise exception 'published tape positions must not be discarded'; end if;
end $$;
alter table canonical_receipt_quarantine drop column publication_sequence;
alter table free_assessment_attempts drop column publication_sequence;
commit;
