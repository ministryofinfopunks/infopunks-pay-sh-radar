begin;
create table free_assessment_attempts (
  request_key text primary key,
  request_hash text not null check (request_hash ~ '^sha256:[a-f0-9]{64}$'),
  attempt_hash text not null unique check (attempt_hash ~ '^sha256:[a-f0-9]{64}$'),
  accepted_at timestamptz not null default now(),
  attempt jsonb not null check (jsonb_typeof(attempt)='object'),
  check (attempt->>'request_key'=request_key and attempt->>'request_hash'=request_hash and attempt->>'attempt_hash'=attempt_hash)
);
create trigger free_assessment_attempts_immutable before update or delete on free_assessment_attempts
  for each row execute function canonical_receipt_immutable();
create trigger free_assessment_attempts_no_truncate before truncate on free_assessment_attempts
  for each statement execute function canonical_receipt_immutable();
commit;
