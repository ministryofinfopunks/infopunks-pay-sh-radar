begin;
create table if not exists ipx_genesis_calls_v2 (
  policy_hash text not null, wallet text not null check(wallet=lower(wallet)),
  ordinal integer not null check(ordinal between 1 and 4663), payload_hash text not null,
  receipt jsonb not null, primary key(policy_hash,wallet), unique(policy_hash,ordinal), unique(payload_hash)
);
create function ipx_launch_append_only() returns trigger language plpgsql as $$ begin raise exception 'IPX launch records are append-only'; end $$;
create table ipx_launch_policies (
  policy_hash text primary key, token_contract text not null unique, genesis_distributor text not null unique, policy jsonb not null
);
create trigger ipx_policy_immutable before update or delete on ipx_launch_policies for each row execute function ipx_launch_append_only();
create trigger ipx_genesis_immutable before update or delete on ipx_genesis_calls_v2 for each row execute function ipx_launch_append_only();
create table ipx_identity_mappings (
  policy_hash text not null, evm_wallet text not null, solana_wallet text not null, nonce text not null unique,
  payload_hash text not null unique, receipt jsonb not null,
  primary key(policy_hash,evm_wallet), unique(policy_hash,solana_wallet)
);
create trigger ipx_identity_immutable before update or delete on ipx_identity_mappings for each row execute function ipx_launch_append_only();
create table ipx_solana_observations (
  signature text not null, watch_address text not null, payload_hash text not null, receipt jsonb not null,
  primary key(signature,watch_address)
);
create trigger ipx_solana_immutable before update or delete on ipx_solana_observations for each row execute function ipx_launch_append_only();
create table ipx_solana_cursors(address text primary key, state jsonb not null);
create table if not exists ipx_economic_receipts (
  receipt_id text primary key, kind text not null check(kind in ('SERVICE','REVENUE','CONTRIBUTION','PURCHASE','BURN')),
  dedupe_key text not null unique, parent_id text references ipx_economic_receipts(receipt_id), receipt_hash text not null unique, receipt jsonb not null
);
create trigger ipx_economic_immutable before update or delete on ipx_economic_receipts for each row execute function ipx_launch_append_only();
commit;
