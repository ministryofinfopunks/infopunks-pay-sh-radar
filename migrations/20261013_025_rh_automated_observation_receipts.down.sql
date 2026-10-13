begin;
do $$ begin
  if exists(select 1 from rh_automated_observation_receipts) then
    raise exception 'immutable observation editions exist; disable scheduler/publication and remediate forward';
  end if;
end $$;
drop table if exists rh_automated_observation_publications;
drop table if exists rh_automated_observation_receipts;
drop function if exists rh_automated_observation_immutable();
commit;
