-- RH Pulse Phase 2 participation authority.
-- Apply through the normal migration runner. Application startup never executes DDL.
begin;

create table if not exists rh_pulse_counters (
  counter_name text primary key,
  current_value bigint not null check (current_value >= 0),
  updated_at timestamptz not null
);

insert into rh_pulse_counters (counter_name, current_value, updated_at)
values
  ('rh_pulse_public_call_number', 0, now()),
  ('rh_pulse_window_sequence', 0, now())
on conflict (counter_name) do nothing;

create table if not exists rh_pulse_windows (
  id text primary key,
  sequence_number bigint not null unique check (sequence_number > 0),
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  call_submission_closes_at timestamptz not null,
  status text not null check (status in ('not_open', 'open', 'closed', 'resolving', 'resolved', 'cancelled')),
  methodology_version text not null check (methodology_version = 'rh-pulse-v1.0'),
  source_health jsonb not null,
  audit_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  closed_at timestamptz,
  resolved_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  constraint rh_pulse_windows_time_order_check check (
    opens_at < closes_at
    and call_submission_closes_at >= opens_at
    and call_submission_closes_at <= closes_at
  ),
  constraint rh_pulse_windows_cancel_reason_check check (
    (status = 'cancelled' and cancelled_at is not null and cancellation_reason is not null)
    or status <> 'cancelled'
  )
);

create unique index if not exists rh_pulse_windows_one_open_idx
  on rh_pulse_windows ((status))
  where status = 'open';
create index if not exists rh_pulse_windows_status_sequence_idx
  on rh_pulse_windows (status, sequence_number desc);

create table if not exists rh_pulse_call_challenges (
  id text primary key,
  window_id text not null references rh_pulse_windows(id) on delete restrict,
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  selected_outcome text not null check (selected_outcome in (
    'agents_to_rwas',
    'memes_to_agents',
    'memes_to_rwas',
    'no_qualified_rotation'
  )),
  nonce_hash text not null unique check (nonce_hash ~ '^[a-f0-9]{64}$'),
  signed_message text not null,
  domain text not null,
  uri text not null,
  chain_id integer not null check (chain_id = 4663),
  methodology_version text not null check (methodology_version = 'rh-pulse-v1.0'),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null,
  constraint rh_pulse_call_challenges_time_order_check check (
    issued_at < expires_at
    and created_at <= issued_at
    and (used_at is null or used_at >= issued_at)
  )
);

create index if not exists rh_pulse_call_challenges_wallet_window_idx
  on rh_pulse_call_challenges (wallet_address, window_id, created_at desc);
create index if not exists rh_pulse_call_challenges_expiry_idx
  on rh_pulse_call_challenges (expires_at)
  where used_at is null;

create table if not exists rh_pulse_calls (
  id text primary key,
  public_call_number bigint not null unique check (public_call_number > 0),
  window_id text not null references rh_pulse_windows(id) on delete restrict,
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  selected_outcome text not null check (selected_outcome in (
    'agents_to_rwas',
    'memes_to_agents',
    'memes_to_rwas',
    'no_qualified_rotation'
  )),
  signature text not null check (signature ~ '^0x[0-9a-fA-F]+$'),
  signed_message_hash text not null check (signed_message_hash ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz not null,
  verification_status text not null check (verification_status = 'verified'),
  abuse_status text not null check (abuse_status in ('clear', 'review_required')),
  genesis_rank integer unique,
  public_slug text not null unique,
  methodology_version text not null check (methodology_version = 'rh-pulse-v1.0'),
  created_at timestamptz not null,
  unique (window_id, wallet_address),
  constraint rh_pulse_calls_genesis_rank_check check (
    (
      public_call_number between 1 and 4663
      and genesis_rank is not null
      and genesis_rank = public_call_number
    )
    or (public_call_number > 4663 and genesis_rank is null)
  )
);

create index if not exists rh_pulse_calls_window_outcome_idx
  on rh_pulse_calls (window_id, selected_outcome, public_call_number);
create index if not exists rh_pulse_calls_recorded_at_idx
  on rh_pulse_calls (recorded_at desc);

create table if not exists rh_pulse_call_receipts (
  id text primary key,
  call_id text not null references rh_pulse_calls(id) on delete restrict,
  receipt_version text not null check (receipt_version = '1.0'),
  public_slug text not null unique,
  receipt_payload jsonb not null,
  receipt_hash text not null unique check (receipt_hash ~ '^sha256:[a-f0-9]{64}$'),
  supersedes_receipt_id text references rh_pulse_call_receipts(id) on delete restrict,
  created_at timestamptz not null,
  constraint rh_pulse_call_receipts_no_self_supersession_check check (
    supersedes_receipt_id is null or supersedes_receipt_id <> id
  )
);

create index if not exists rh_pulse_call_receipts_call_created_idx
  on rh_pulse_call_receipts (call_id, created_at desc);

create table if not exists rh_pulse_audit_events (
  id text primary key,
  event_type text not null check (event_type in (
    'challenge_created',
    'challenge_rejected',
    'signature_verified',
    'signature_rejected',
    'call_accepted',
    'duplicate_call_rejected',
    'receipt_created',
    'window_created',
    'window_opened',
    'window_closed',
    'window_cancelled',
    'abuse_check_triggered'
  )),
  window_id text references rh_pulse_windows(id) on delete restrict,
  challenge_id text references rh_pulse_call_challenges(id) on delete restrict,
  call_id text references rh_pulse_calls(id) on delete restrict,
  wallet_hash text check (wallet_hash is null or wallet_hash ~ '^[a-f0-9]{64}$'),
  request_origin_hash text check (request_origin_hash is null or request_origin_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb not null,
  created_at timestamptz not null
);

create index if not exists rh_pulse_audit_events_window_time_idx
  on rh_pulse_audit_events (window_id, created_at desc);
create index if not exists rh_pulse_audit_events_call_time_idx
  on rh_pulse_audit_events (call_id, created_at desc);

create or replace function rh_pulse_reject_receipt_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'RH Pulse call receipts are immutable; insert a superseding receipt instead';
end;
$$;

drop trigger if exists rh_pulse_call_receipts_immutable on rh_pulse_call_receipts;
create trigger rh_pulse_call_receipts_immutable
before update or delete on rh_pulse_call_receipts
for each row execute function rh_pulse_reject_receipt_mutation();

commit;
