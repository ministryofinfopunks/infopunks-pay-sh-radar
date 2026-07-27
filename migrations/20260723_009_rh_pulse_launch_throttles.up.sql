-- RH Pulse Phase 3B multi-instance launch throttling.
-- Bucket keys are server-secret HMACs. Raw wallets, origins and challenge IDs are forbidden.
begin;

create table if not exists rh_pulse_rate_limit_buckets (
  bucket_key text primary key check (bucket_key ~ '^v[0-9]+:[a-f0-9]{64}$'),
  bucket_type text not null check (bucket_type in (
    'challenge_wallet',
    'challenge_origin',
    'call_challenge',
    'invalid_signature',
    'internal_mutation'
  )),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  blocked_until timestamptz,
  updated_at timestamptz not null,
  expires_at timestamptz not null,
  constraint rh_pulse_rate_limit_time_order_check check (
    window_started_at < expires_at
    and updated_at >= window_started_at
    and (blocked_until is null or blocked_until <= expires_at)
  )
);

create index if not exists rh_pulse_rate_limit_buckets_expiry_idx
  on rh_pulse_rate_limit_buckets (expires_at);

commit;
