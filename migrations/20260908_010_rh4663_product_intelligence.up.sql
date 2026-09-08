-- Phase 10.1: bounded, privacy-minimised //4663 loop analytics.
-- Deliberately no raw payload, wallet, signature, balance, holdings, follow
-- list, user-agent, IP, URL history, or free-text column exists here.
create table if not exists rh4663_product_intelligence_events (
  event_id text primary key,
  occurred_at timestamptz not null,
  event_name text not null,
  identity_key text null,
  entry_source text not null check (entry_source in ('DIRECT', 'NOW_SHARE', 'WATCH_SHARE', 'OPEN_LOOP_SHARE', 'CALL_SHARE', 'RESOLUTION_SHARE', 'PROOF_SHARE', 'CENSUS_SHARE', 'RADAR_SHARE', 'CAMPAIGN_SHARE', 'UNKNOWN')),
  campaign_id text null,
  window_id text null,
  subject_id text null,
  share_object_id text null,
  receipt_id text null,
  call_receipt_id text null,
  methodology_version text not null check (methodology_version = 'rh4663.product-intelligence.v1')
);

create index if not exists rh4663_product_intelligence_events_window_idx
  on rh4663_product_intelligence_events (occurred_at asc);
create index if not exists rh4663_product_intelligence_events_campaign_window_idx
  on rh4663_product_intelligence_events (campaign_id, occurred_at asc);
create index if not exists rh4663_product_intelligence_events_call_idx
  on rh4663_product_intelligence_events (call_receipt_id, occurred_at asc);

-- Covers a pre-migration best-effort table without retaining new data fields.
alter table rh4663_product_intelligence_events add column if not exists subject_id text null;
alter table rh4663_product_intelligence_events add column if not exists share_object_id text null;
