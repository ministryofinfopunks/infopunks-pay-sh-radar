-- Additive Phase 1 storage for the public Infopunks //4663 operating surface.
-- Migrations remain external-only; application startup never runs this file.
create table if not exists rh_4663_genesis_wallets (
  wallet text primary key,
  ordinal integer not null unique check (ordinal between 1 and 4663),
  created_at timestamptz not null
);

create table if not exists rh_4663_pulse_calls (
  receipt_id text primary key,
  wallet text not null,
  window_id text not null,
  created_at timestamptz not null,
  payload jsonb not null,
  unique (wallet, window_id)
);
create index if not exists rh_4663_pulse_calls_window_idx
  on rh_4663_pulse_calls (window_id, created_at desc);

create table if not exists rh_4663_events (
  event_id text primary key,
  detected_at timestamptz not null,
  category text not null,
  publication_state text not null,
  payload jsonb not null
);
create index if not exists rh_4663_events_detected_idx
  on rh_4663_events (detected_at desc);

create table if not exists rh_4663_today_editions (
  edition_id text primary key,
  edition_date date not null unique,
  generated_at timestamptz not null,
  payload jsonb not null
);

create table if not exists rh_4663_signals (
  signal_id text primary key,
  lifecycle_state text not null check (lifecycle_state in ('submitted', 'watching', 'evidence_added', 'confirmed', 'rejected', 'unresolved')),
  original_submitter text not null,
  submitted_at timestamptz not null,
  updated_at timestamptz not null,
  payload jsonb not null
);
create index if not exists rh_4663_signals_updated_idx
  on rh_4663_signals (updated_at desc);
