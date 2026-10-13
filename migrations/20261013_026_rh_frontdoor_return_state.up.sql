begin;
create table if not exists rh4663_frontdoor_version (singleton boolean primary key default true check(singleton), fingerprint text not null, sources jsonb not null, version bigint not null, updated_at timestamptz not null default now());
create table if not exists rh4663_frontdoor_change_events (event_id text primary key, frontdoor_version bigint not null, occurred_at timestamptz not null, source_type text not null, source_ref jsonb not null, change_type text not null, headline text not null, before_value jsonb, after_value jsonb not null, importance integer not null, deep_link text not null, source_observed_at timestamptz);
create index if not exists rh4663_frontdoor_change_events_version_idx on rh4663_frontdoor_change_events(frontdoor_version desc);
create index if not exists rh4663_frontdoor_change_events_occurred_idx on rh4663_frontdoor_change_events(occurred_at desc);
create table if not exists rh4663_frontdoor_open_loops(loop_id text primary key,last_changed_at timestamptz not null,payload jsonb not null);
commit;
