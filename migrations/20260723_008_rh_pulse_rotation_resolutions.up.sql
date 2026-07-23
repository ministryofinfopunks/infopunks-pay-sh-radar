-- RH Pulse Phase 3A deterministic resolution authority and immutable Rotation Receipts.
begin;

create table if not exists rh_pulse_resolution_runs (
  id text primary key,
  window_id text not null references rh_pulse_windows(id) on delete restrict,
  run_number integer not null check (run_number > 0),
  status text not null check (status in (
    'not_ready', 'ready', 'calculating', 'blocked', 'draft',
    'approved', 'published', 'cancelled'
  )),
  methodology_version text not null check (methodology_version = 'rh-pulse-v1.0'),
  input_manifest jsonb not null,
  input_manifest_hash text not null check (input_manifest_hash ~ '^sha256:[a-f0-9]{64}$'),
  candidate_scores jsonb not null,
  proposed_outcome text check (
    proposed_outcome is null or proposed_outcome in (
      'agents_to_rwas',
      'memes_to_agents',
      'memes_to_rwas',
      'no_qualified_rotation'
    )
  ),
  confidence text not null check (confidence in ('high', 'medium', 'low', 'insufficient')),
  evidence_summary jsonb not null,
  limitations jsonb not null,
  blocked_reason text,
  outcome_explanation text not null,
  created_at timestamptz not null,
  calculated_at timestamptz not null,
  approved_at timestamptz,
  approved_by text,
  cancelled_at timestamptz,
  unique (window_id, run_number),
  unique (window_id, input_manifest_hash),
  constraint rh_pulse_resolution_runs_blocked_check check (
    (status = 'blocked' and blocked_reason is not null and proposed_outcome is null)
    or status <> 'blocked'
  ),
  constraint rh_pulse_resolution_runs_result_check check (
    status in ('not_ready', 'calculating', 'blocked', 'cancelled')
    or proposed_outcome is not null
  ),
  constraint rh_pulse_resolution_runs_approval_check check (
    (status in ('approved', 'published') and approved_at is not null and approved_by is not null)
    or status not in ('approved', 'published')
  ),
  constraint rh_pulse_resolution_runs_cancelled_check check (
    (status = 'cancelled' and cancelled_at is not null)
    or status <> 'cancelled'
  )
);

create index if not exists rh_pulse_resolution_runs_window_status_idx
  on rh_pulse_resolution_runs (window_id, status, run_number desc);

create or replace function rh_pulse_reject_published_resolution_run_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'published' then
    raise exception 'Published RH Pulse resolution runs are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists rh_pulse_resolution_runs_published_immutable on rh_pulse_resolution_runs;
create trigger rh_pulse_resolution_runs_published_immutable
before update or delete on rh_pulse_resolution_runs
for each row execute function rh_pulse_reject_published_resolution_run_mutation();

create table if not exists rh_pulse_rotation_receipts (
  id text primary key,
  window_id text not null references rh_pulse_windows(id) on delete restrict,
  resolution_run_id text not null unique references rh_pulse_resolution_runs(id) on delete restrict,
  receipt_version text not null check (receipt_version = '1.0'),
  public_slug text not null unique,
  winning_outcome text not null check (winning_outcome in (
    'agents_to_rwas',
    'memes_to_agents',
    'memes_to_rwas',
    'no_qualified_rotation'
  )),
  receipt_payload jsonb not null,
  receipt_hash text not null unique check (receipt_hash ~ '^sha256:[a-f0-9]{64}$'),
  supersedes_receipt_id text references rh_pulse_rotation_receipts(id) on delete restrict,
  published_at timestamptz not null,
  created_at timestamptz not null,
  unique (window_id),
  constraint rh_pulse_rotation_receipts_no_self_supersession_check check (
    supersedes_receipt_id is null or supersedes_receipt_id <> id
  )
);

create index if not exists rh_pulse_rotation_receipts_published_idx
  on rh_pulse_rotation_receipts (published_at desc, id);

create or replace function rh_pulse_validate_rotation_receipt_publication()
returns trigger
language plpgsql
as $$
declare
  run_status text;
  run_window_id text;
  run_outcome text;
  run_manifest_hash text;
  run_calculation_at timestamptz;
  window_status text;
begin
  select status, window_id, proposed_outcome, input_manifest_hash,
         (input_manifest->>'calculation_at')::timestamptz
    into run_status, run_window_id, run_outcome, run_manifest_hash, run_calculation_at
    from rh_pulse_resolution_runs
    where id = new.resolution_run_id
    for update;

  if run_status is null then
    raise exception 'rotation receipt requires an existing resolution run';
  end if;
  if run_status <> 'approved' then
    raise exception 'rotation receipt requires an approved resolution run';
  end if;
  if run_window_id <> new.window_id or run_outcome <> new.winning_outcome then
    raise exception 'rotation receipt authority mismatch';
  end if;
  if run_manifest_hash is null or run_manifest_hash = '' then
    raise exception 'rotation receipt requires an input-manifest hash';
  end if;
  if run_calculation_at is null or run_calculation_at > clock_timestamp() then
    raise exception 'rotation receipt requires a non-future calculation timestamp';
  end if;
  if new.published_at > clock_timestamp() then
    raise exception 'rotation receipt publication timestamp cannot be in the future';
  end if;

  select status into window_status
    from rh_pulse_windows
    where id = new.window_id
    for update;
  if window_status <> 'closed' then
    raise exception 'rotation receipt requires a closed window';
  end if;
  return new;
end;
$$;

drop trigger if exists rh_pulse_rotation_receipts_validate on rh_pulse_rotation_receipts;
create trigger rh_pulse_rotation_receipts_validate
before insert on rh_pulse_rotation_receipts
for each row execute function rh_pulse_validate_rotation_receipt_publication();

create or replace function rh_pulse_reject_rotation_receipt_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'RH Pulse Rotation Receipts are immutable after publication';
end;
$$;

drop trigger if exists rh_pulse_rotation_receipts_immutable on rh_pulse_rotation_receipts;
create trigger rh_pulse_rotation_receipts_immutable
before update or delete on rh_pulse_rotation_receipts
for each row execute function rh_pulse_reject_rotation_receipt_mutation();

alter table rh_pulse_audit_events
  drop constraint if exists rh_pulse_audit_events_event_type_check;
alter table rh_pulse_audit_events
  add constraint rh_pulse_audit_events_event_type_check check (event_type in (
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
    'abuse_check_triggered',
    'resolution_previewed',
    'resolution_blocked',
    'resolution_draft_created',
    'resolution_approved',
    'resolution_cancelled',
    'resolution_published',
    'resolution_publication_conflict',
    'rotation_receipt_created',
    'resolution_transaction_rolled_back'
  ));

commit;
