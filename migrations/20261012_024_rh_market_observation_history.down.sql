begin;
-- Never erase the only remaining evidence after raw-series retention has run.
do $$
begin
  if exists (select 1 from rh_chain_market_aggregates) then
    raise exception 'market observation history exists; disable collection and remediate forward';
  end if;
end;
$$;
drop trigger if exists rh_chain_market_snapshot_rollup on rh_chain_market_snapshots;
drop function if exists rh_chain_market_snapshot_rollup_trigger();
drop function if exists rh_chain_rollup_market_snapshot(jsonb);
drop function if exists rh_chain_merge_market_aggregate(jsonb,jsonb,text);
drop table if exists rh_chain_market_aggregates;
commit;
