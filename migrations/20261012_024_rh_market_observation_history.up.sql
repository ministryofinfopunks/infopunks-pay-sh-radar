begin;

-- Collection memory only: no signal, receipt, score, or judgment table is writable here.
create table if not exists rh_chain_market_aggregates (
  token_address text not null,
  pair_address text not null,
  provider text not null,
  resolution text not null check (resolution in ('hour', 'day')),
  bucket_start timestamptz not null,
  payload jsonb not null,
  primary key (token_address, pair_address, provider, resolution, bucket_start)
);
create index if not exists rh_chain_market_aggregates_contract_time_idx
  on rh_chain_market_aggregates (token_address, resolution, bucket_start desc);
create index if not exists rh_chain_market_aggregates_retention_idx
  on rh_chain_market_aggregates (resolution, bucket_start);

create or replace function rh_chain_merge_market_aggregate(previous jsonb, sample jsonb, granularity text)
returns jsonb language plpgsql immutable as $$
declare
  metric text;
  value numeric;
  old jsonb;
  evidence jsonb;
  metrics jsonb := '{}'::jsonb;
  bounds timestamptz := date_trunc(granularity, (sample->>'captured_at')::timestamptz at time zone 'UTC') at time zone 'UTC';
  first_sample jsonb := sample;
  last_sample jsonb := sample;
begin
  if previous->'snapshot_ids' ? (sample->>'snapshot_id') then return previous; end if;
  if previous is not null then
    if ((previous->'first_snapshot'->>'captured_at')::timestamptz, previous->'first_snapshot'->>'snapshot_id')
        < ((sample->>'captured_at')::timestamptz, sample->>'snapshot_id') then
      first_sample := previous->'first_snapshot';
    end if;
    if ((previous->'last_snapshot'->>'captured_at')::timestamptz, previous->'last_snapshot'->>'snapshot_id')
        > ((sample->>'captured_at')::timestamptz, sample->>'snapshot_id') then
      last_sample := previous->'last_snapshot';
    end if;
  end if;
  foreach metric in array array['price_usd','liquidity_usd','market_cap','fdv','volume_h24','volume_h6','volume_h1',
      'txns_h24_buys','txns_h24_sells','txns_h6_buys','txns_h6_sells','price_change_h24','price_change_h6','price_change_h1']
  loop
    old := coalesce(previous->'metrics'->metric, '{"covered_samples":0,"min":null,"max":null}'::jsonb);
    if jsonb_typeof(sample->metric) = 'number' then
      value := (sample->>metric)::numeric;
      evidence := jsonb_build_object('snapshot_id',sample->>'snapshot_id','captured_at',sample->>'captured_at',
        'provider_timestamp',sample->'provider_timestamp','source_url',sample->'source_url','value',value);
      old := jsonb_set(old, '{covered_samples}', to_jsonb((old->>'covered_samples')::integer + 1));
      if old->'min' = 'null'::jsonb or value < (old->'min'->>'value')::numeric
          or (value = (old->'min'->>'value')::numeric and
            ((sample->>'captured_at')::timestamptz,sample->>'snapshot_id') <
            ((old->'min'->>'captured_at')::timestamptz,old->'min'->>'snapshot_id')) then
        old := jsonb_set(old, '{min}', evidence);
      end if;
      if old->'max' = 'null'::jsonb or value > (old->'max'->>'value')::numeric
          or (value = (old->'max'->>'value')::numeric and
            ((sample->>'captured_at')::timestamptz,sample->>'snapshot_id') <
            ((old->'max'->>'captured_at')::timestamptz,old->'max'->>'snapshot_id')) then
        old := jsonb_set(old, '{max}', evidence);
      end if;
    end if;
    metrics := metrics || jsonb_build_object(metric,old);
  end loop;
  return jsonb_build_object('version','rh-market-history-v1','resolution',granularity,
    'bucket_start',to_char(bounds at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'bucket_end',to_char((bounds + case when granularity='hour' then interval '1 hour' else interval '1 day' end) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'token_address',lower(sample->>'token_address'),'pair_address',lower(sample->>'pair_address'),
    'provider',sample->>'provider','chain_id',sample->>'chain_id',
    'sample_count',coalesce((previous->>'sample_count')::integer,0)+1,
    'snapshot_ids',(select jsonb_agg(id order by id collate "C") from
      (select jsonb_array_elements_text(coalesce(previous->'snapshot_ids','[]'::jsonb)) as id
        union select sample->>'snapshot_id') ids),
    'first_snapshot',first_sample,'last_snapshot',last_sample,'metrics',metrics);
end;
$$;

create or replace function rh_chain_rollup_market_snapshot(sample jsonb)
returns void language plpgsql as $$
declare
  granularity text;
begin
  foreach granularity in array array['hour','day'] loop
    insert into rh_chain_market_aggregates (token_address,pair_address,provider,resolution,bucket_start,payload)
      values (lower(sample->>'token_address'),coalesce(lower(sample->>'pair_address'),''),sample->>'provider',granularity,
        date_trunc(granularity,(sample->>'captured_at')::timestamptz at time zone 'UTC') at time zone 'UTC',
        rh_chain_merge_market_aggregate(null,sample,granularity))
    on conflict (token_address,pair_address,provider,resolution,bucket_start) do update
      set payload=rh_chain_merge_market_aggregate(rh_chain_market_aggregates.payload,sample,granularity);
  end loop;
end;
$$;

create or replace function rh_chain_market_snapshot_rollup_trigger()
returns trigger language plpgsql as $$
begin
  perform rh_chain_rollup_market_snapshot(new.payload);
  return new;
end;
$$;

-- A single atomic transaction backfills existing retained observations before any raw pruning.
-- Serial row upserts preserve all concurrent inserts; ON CONFLICT raw replays do not fire this trigger.
lock table rh_chain_market_snapshots in share row exclusive mode;
do $$
declare
  sample record;
begin
  if not exists (select 1 from rh_chain_market_aggregates) then
    for sample in select payload from rh_chain_market_snapshots order by captured_at,snapshot_id loop
      perform rh_chain_rollup_market_snapshot(sample.payload);
    end loop;
  end if;
end;
$$;
drop trigger if exists rh_chain_market_snapshot_rollup on rh_chain_market_snapshots;
create trigger rh_chain_market_snapshot_rollup after insert on rh_chain_market_snapshots
  for each row execute function rh_chain_market_snapshot_rollup_trigger();

commit;
