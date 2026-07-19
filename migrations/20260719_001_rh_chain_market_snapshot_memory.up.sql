begin;

create table if not exists rh_chain_market_snapshots (
  snapshot_id text primary key,
  token_address text not null,
  captured_at timestamptz not null,
  payload jsonb not null
);

alter table rh_chain_market_snapshots add column if not exists pair_address text;
alter table rh_chain_market_snapshots add column if not exists provider text not null default 'dexscreener';
alter table rh_chain_market_snapshots add column if not exists provider_timestamp timestamptz;
alter table rh_chain_market_snapshots add column if not exists raw_data_version text not null default 'legacy-v1';

create index if not exists rh_chain_market_snapshots_token_captured_idx
  on rh_chain_market_snapshots (token_address, captured_at desc);
create index if not exists rh_chain_market_snapshots_pair_captured_idx
  on rh_chain_market_snapshots (pair_address, captured_at desc)
  where pair_address is not null;
create index if not exists rh_chain_market_snapshots_provider_captured_idx
  on rh_chain_market_snapshots (provider, captured_at desc);
create index if not exists rh_chain_market_snapshots_captured_at_idx
  on rh_chain_market_snapshots (captured_at desc);

commit;
