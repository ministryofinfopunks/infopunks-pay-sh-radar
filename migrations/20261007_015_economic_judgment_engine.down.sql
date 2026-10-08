begin;
do $$ begin
  if exists(select 1 from economic_engine_records) then raise exception 'refusing to remove populated economic judgment memory'; end if;
end $$;
drop table if exists economic_engine_records;
drop function if exists protect_economic_engine_memory();
commit;
