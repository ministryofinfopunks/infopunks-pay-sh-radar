-- Machine policy receipts are separate from human-reviewed project publications.
create table if not exists rh_chain_spend_receipts (
  receipt_id text primary key,
  created_at timestamptz not null,
  payload jsonb not null
);
