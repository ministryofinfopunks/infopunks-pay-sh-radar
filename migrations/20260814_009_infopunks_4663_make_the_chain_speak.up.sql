-- Phase 3: evidence-first automated intelligence for Infopunks //4663.
-- This migration is additive. Application startup never applies it.

create table if not exists rh_4663_observations (
  observation_id text primary key,
  provider text not null,
  provider_observation_id text not null,
  subject_id text not null,
  metric text not null,
  observed_at timestamptz not null,
  ingested_at timestamptz not null,
  submitted_by text,
  payload_hash text not null check (payload_hash ~ '^sha256:[0-9a-f]{64}$'),
  payload jsonb not null,
  unique (provider, provider_observation_id)
);
create index if not exists rh_4663_observations_subject_metric_idx
  on rh_4663_observations (subject_id, metric, observed_at desc);
create index if not exists rh_4663_observations_observed_idx
  on rh_4663_observations (observed_at desc);

create table if not exists rh_4663_signal_candidates (
  candidate_id text primary key,
  event_fingerprint text not null unique,
  publication_state text not null check (publication_state in ('candidate','auto_publishable','review_required','held','published','rejected')),
  risk_class text not null check (risk_class in ('low','medium','high')),
  generated_at timestamptz not null,
  updated_at timestamptz not null,
  outcome text check (outcome is null or outcome in ('published','held','rejected','review_required','false_positive','duplicate','insufficient_evidence')),
  payload jsonb not null
);
create index if not exists rh_4663_signal_candidates_state_idx
  on rh_4663_signal_candidates (publication_state, generated_at desc);

create table if not exists rh_4663_signal_publications (
  signal_id text primary key,
  candidate_id text not null unique references rh_4663_signal_candidates(candidate_id),
  category text not null,
  signal_type text not null,
  published_at timestamptz not null,
  publication_hash text not null check (publication_hash ~ '^sha256:[0-9a-f]{64}$'),
  distribution_state text not null default 'not_queued' check (distribution_state in ('not_queued','queued','sent','failed')),
  reviewer_id text,
  payload jsonb not null
);
create index if not exists rh_4663_signal_publications_archive_idx
  on rh_4663_signal_publications (published_at desc, category, signal_type);

create table if not exists rh_4663_signal_distribution (
  signal_id text primary key references rh_4663_signal_publications(signal_id),
  state text not null default 'not_queued' check (state in ('not_queued','queued','sent','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  updated_at timestamptz not null,
  error_code text
);
create index if not exists rh_4663_signal_distribution_state_idx
  on rh_4663_signal_distribution (state, updated_at);

create table if not exists rh_4663_signal_corrections (
  correction_id text primary key,
  signal_id text not null references rh_4663_signal_publications(signal_id),
  correction_type text not null check (correction_type in ('CORRECTION','SUPERSEDED','UPDATED_EVIDENCE')),
  created_at timestamptz not null,
  reviewer_id text not null,
  payload jsonb not null
);
create index if not exists rh_4663_signal_corrections_signal_idx
  on rh_4663_signal_corrections (signal_id, created_at asc);

create table if not exists rh_4663_provider_health (
  provider text primary key,
  state text not null check (state in ('healthy','degraded','disabled')),
  updated_at timestamptz not null,
  payload jsonb not null
);

create or replace function rh_4663_reject_signal_publication_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'immutable 4663 Signal publication history cannot be changed; append a correction';
end $$;

drop trigger if exists rh_4663_signal_publications_immutable on rh_4663_signal_publications;
create trigger rh_4663_signal_publications_immutable
before update or delete on rh_4663_signal_publications
for each row execute function rh_4663_reject_signal_publication_mutation();

create or replace function rh_4663_reject_signal_correction_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'immutable 4663 Signal correction history cannot be changed';
end $$;

drop trigger if exists rh_4663_signal_corrections_immutable on rh_4663_signal_corrections;
create trigger rh_4663_signal_corrections_immutable
before update or delete on rh_4663_signal_corrections
for each row execute function rh_4663_reject_signal_correction_mutation();
