begin;

drop index if exists rh_chain_market_snapshots_captured_at_idx;
drop index if exists rh_chain_market_snapshots_provider_captured_idx;
drop index if exists rh_chain_market_snapshots_pair_captured_idx;

alter table if exists rh_chain_market_snapshots drop column if exists raw_data_version;
alter table if exists rh_chain_market_snapshots drop column if exists provider_timestamp;
alter table if exists rh_chain_market_snapshots drop column if exists provider;
alter table if exists rh_chain_market_snapshots drop column if exists pair_address;

commit;
