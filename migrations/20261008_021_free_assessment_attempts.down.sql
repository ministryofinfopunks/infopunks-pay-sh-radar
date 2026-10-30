begin;
do $$ begin
  if exists (select 1 from free_assessment_attempts limit 1) then
    raise exception 'free assessment attempts must not be discarded';
  end if;
end $$;
drop table free_assessment_attempts;
commit;
