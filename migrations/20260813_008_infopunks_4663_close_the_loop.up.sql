-- Phase 2: deterministic Pulse resolution, acceptance commitments, and anchors.
-- Application startup does not apply this migration. Apply only after 007 is verified.
create table if not exists rh_4663_pulse_window_resolutions (
  window_id text primary key,
  state text not null check (state in ('resolved', 'published')),
  resolved_at timestamptz not null,
  published_at timestamptz,
  payload jsonb not null,
  check ((state = 'resolved' and published_at is null) or (state = 'published' and published_at is not null))
);

create table if not exists rh_4663_resolution_receipts (
  receipt_id text primary key check (receipt_id ~ '^IP-RES-[0-9A-F]+$'),
  call_receipt_id text not null unique references rh_4663_pulse_calls(receipt_id),
  wallet text not null,
  window_id text not null references rh_4663_pulse_window_resolutions(window_id),
  created_at timestamptz not null,
  payload jsonb not null,
  unique (window_id, call_receipt_id)
);
create index if not exists rh_4663_resolution_receipts_wallet_idx on rh_4663_resolution_receipts (lower(wallet), window_id);

create table if not exists rh_4663_window_anchors (
  window_id text primary key references rh_4663_pulse_window_resolutions(window_id),
  state text not null check (state in ('not_submitted', 'submitting', 'submitted', 'confirmed', 'failed')),
  transaction_hash text,
  updated_at timestamptz not null,
  payload jsonb not null,
  check (state not in ('submitted', 'confirmed') or transaction_hash is not null)
);

create or replace function rh_4663_reject_resolution_receipt_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'immutable 4663 RESOLUTION receipt history cannot be changed';
end $$;

drop trigger if exists rh_4663_resolution_receipts_immutable on rh_4663_resolution_receipts;
create trigger rh_4663_resolution_receipts_immutable
before update or delete on rh_4663_resolution_receipts
for each row execute function rh_4663_reject_resolution_receipt_mutation();

create or replace function rh_4663_protect_published_resolution() returns trigger language plpgsql as $$
begin
  if old.state = 'published' and (
    new.window_id is distinct from old.window_id
    or new.state is distinct from old.state
    or new.resolved_at is distinct from old.resolved_at
    or new.published_at is distinct from old.published_at
    or (new.payload - 'anchor') is distinct from (old.payload - 'anchor')
  ) then
    raise exception 'published 4663 resolution material is immutable';
  end if;
  return new;
end $$;

drop trigger if exists rh_4663_published_resolution_immutable on rh_4663_pulse_window_resolutions;
create trigger rh_4663_published_resolution_immutable
before update on rh_4663_pulse_window_resolutions
for each row execute function rh_4663_protect_published_resolution();

create or replace function rh_4663_protect_confirmed_anchor() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' or old.state = 'confirmed' then
    raise exception 'confirmed 4663 anchor history is immutable';
  end if;
  return new;
end $$;

drop trigger if exists rh_4663_confirmed_anchor_immutable on rh_4663_window_anchors;
create trigger rh_4663_confirmed_anchor_immutable
before update or delete on rh_4663_window_anchors
for each row execute function rh_4663_protect_confirmed_anchor();
