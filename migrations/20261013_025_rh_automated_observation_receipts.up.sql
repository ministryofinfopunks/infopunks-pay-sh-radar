begin;
create table if not exists rh_automated_observation_receipts (
  edition_id text primary key,
  utc_day date not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  supersedes text references rh_automated_observation_receipts(edition_id),
  payload jsonb not null,
  finalized_at timestamptz not null default now(),
  unique(utc_day,content_hash)
);
create unique index if not exists rh_automated_observation_canonical_day_idx on rh_automated_observation_receipts(utc_day) where supersedes is null;
create table if not exists rh_automated_observation_publications (
  edition_id text primary key references rh_automated_observation_receipts(edition_id),
  authorization_ref text not null check(length(authorization_ref)>0),
  published_at timestamptz not null default now()
);
create or replace function rh_automated_observation_immutable() returns trigger language plpgsql as $$
begin raise exception 'automated observation record is immutable; append a correction'; end $$;
drop trigger if exists rh_automated_observation_receipt_immutable on rh_automated_observation_receipts;
create trigger rh_automated_observation_receipt_immutable before update or delete on rh_automated_observation_receipts for each row execute function rh_automated_observation_immutable();
drop trigger if exists rh_automated_observation_publication_immutable on rh_automated_observation_publications;
create trigger rh_automated_observation_publication_immutable before update or delete on rh_automated_observation_publications for each row execute function rh_automated_observation_immutable();
commit;
