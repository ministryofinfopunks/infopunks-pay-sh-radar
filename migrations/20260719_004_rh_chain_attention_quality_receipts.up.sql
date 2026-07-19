-- Apply through the normal migration runner. This file is intentionally not run at application startup.
create table if not exists rh_chain_attention_receipts (
  receipt_id text primary key,
  contract text not null,
  methodology_version text not null,
  status text not null check (status in ('draft', 'published', 'rejected')),
  created_at timestamptz not null,
  superseded_at timestamptz,
  payload jsonb not null
);
create index if not exists rh_chain_attention_receipts_contract_created_idx on rh_chain_attention_receipts (contract, created_at desc);
create index if not exists rh_chain_attention_receipts_status_idx on rh_chain_attention_receipts (status, created_at desc);
