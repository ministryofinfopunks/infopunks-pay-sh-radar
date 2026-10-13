begin;
do $$ begin
  if exists(select 1 from rh4663_frontdoor_open_loops) or exists(select 1 from rh4663_frontdoor_version) or exists(select 1 from rh4663_frontdoor_change_events) then
    raise exception 'durable frontdoor return state exists; retain version namespace and remediate forward';
  end if;
end $$;
drop table if exists rh4663_frontdoor_open_loops;
-- These tables predate 026. Never drop their version/event namespace on rollback.
commit;
