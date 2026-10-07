-- Canonical append-only authority spine. External migration only; no legacy backfill.
begin;
create table observation_receipts (
  observation_id text primary key,
  observed_at timestamptz not null,
  receipt_hash text not null unique check (receipt_hash ~ '^sha256:[a-f0-9]{64}$'),
  receipt jsonb not null check (jsonb_typeof(receipt) = 'object'),
  check (receipt->>'observation_id' = observation_id and receipt->>'receipt_hash' = receipt_hash),
  check (receipt->>'schema_version' = 'canonical-receipts.v1'),
  check (not (receipt ? 'score_delta') and not (receipt ? 'scoreDelta') and not (receipt ? 'confidence_delta')),
  subject_type text not null,
  subject_id text not null,
  check (receipt->>'subject_type'=subject_type and receipt->>'subject_id'=subject_id),
  unique (observation_id,receipt_hash)
);
create index observation_receipts_time_idx on observation_receipts (observed_at);
create index observation_receipts_subject_idx on observation_receipts (subject_type,subject_id);
create index observation_receipts_subject_id_idx on observation_receipts (subject_id);
create table judgment_receipts (
  judgment_id text primary key,
  issued_at timestamptz not null,
  receipt_hash text not null unique check (receipt_hash ~ '^sha256:[a-f0-9]{64}$'),
  receipt jsonb not null check (jsonb_typeof(receipt) = 'object'),
  check (receipt->>'judgment_id' = judgment_id and receipt->>'receipt_hash' = receipt_hash),
  check (receipt->>'schema_version' = 'canonical-receipts.v1'),
  check (not (receipt ? 'score_delta') and not (receipt ? 'scoreDelta') and not (receipt ? 'confidence_delta')),
  subject_type text not null,
  subject_id text not null,
  check (receipt->>'subject_type'=subject_type and receipt->>'subject_id'=subject_id),
  check (jsonb_array_length(receipt->'cited_observation_ids') > 0),
  check (receipt->>'decision' <> 'insufficient_evidence' or ((receipt->>'payment_required')::boolean = false and (receipt->>'charge')::numeric = 0 and receipt->'payment_receipt_ref' = 'null'::jsonb)),
  unique (judgment_id,receipt_hash)
);
create index judgment_receipts_time_idx on judgment_receipts (issued_at);
create index judgment_receipts_subject_idx on judgment_receipts (subject_type,subject_id);
create index judgment_receipts_subject_id_idx on judgment_receipts (subject_id);
create table execution_receipts (
  execution_id text primary key,
  executed_at timestamptz not null,
  receipt_hash text not null unique check (receipt_hash ~ '^sha256:[a-f0-9]{64}$'),
  receipt jsonb not null check (jsonb_typeof(receipt) = 'object'),
  check (receipt->>'execution_id' = execution_id and receipt->>'receipt_hash' = receipt_hash),
  check (receipt->>'schema_version' = 'canonical-receipts.v1'),
  check (not (receipt ? 'score_delta') and not (receipt ? 'scoreDelta') and not (receipt ? 'confidence_delta')),
  judgment_id text not null,
  parent_hash text not null,
  foreign key (judgment_id,parent_hash) references judgment_receipts (judgment_id,receipt_hash),
  check (receipt->>'judgment_id' = judgment_id and receipt->>'parent_hash' = parent_hash),
  unique (execution_id,receipt_hash)
);
create index execution_receipts_time_idx on execution_receipts (executed_at);
create index execution_receipts_judgment_idx on execution_receipts (judgment_id);
create table evaluation_receipts (
  evaluation_id text primary key,
  evaluated_at timestamptz not null,
  receipt_hash text not null unique check (receipt_hash ~ '^sha256:[a-f0-9]{64}$'),
  receipt jsonb not null check (jsonb_typeof(receipt) = 'object'),
  check (receipt->>'evaluation_id' = evaluation_id and receipt->>'receipt_hash' = receipt_hash),
  check (receipt->>'schema_version' = 'canonical-receipts.v1'),
  execution_id text not null unique,
  parent_hash text not null,
  foreign key (execution_id,parent_hash) references execution_receipts (execution_id,receipt_hash),
  check (receipt->>'execution_id' = execution_id and receipt->>'parent_hash' = parent_hash),
  check (receipt->>'policy_version'='receipt-authority.v1'),
  check ((receipt->>'score_delta')::numeric = case receipt->>'outcome' when 'confirmed' then 5 when 'weakened' then -2 when 'contradicted' then -5 end),
  unique (evaluation_id,receipt_hash)
);
create index evaluation_receipts_time_idx on evaluation_receipts (evaluated_at);
create index evaluation_receipts_execution_idx on evaluation_receipts (execution_id);

create table judgment_observations (
  judgment_id text not null references judgment_receipts(judgment_id),
  observation_id text not null references observation_receipts(observation_id),
  primary key (judgment_id, observation_id)
);
create index judgment_observations_observation_idx on judgment_observations (observation_id);

create function canonical_receipt_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'canonical_receipt_immutable' using errcode = '55000';
end;
$$;

-- Deferred validation permits atomic judgment + multi-observation insertion.
create function canonical_judgment_links_valid() returns trigger language plpgsql as $$
declare
  body jsonb;
  item record;
  expected_count integer;
  actual_count integer;
  target_id text;
begin
  target_id := new.judgment_id;
  select receipt into body from judgment_receipts where judgment_id=target_id;
  expected_count := jsonb_array_length(body->'cited_observation_ids');
  select count(*) into actual_count from judgment_observations where judgment_id=target_id;
  if actual_count <> expected_count or expected_count < 1 then
    raise exception 'judgment_observation_membership_invalid' using errcode = '23514';
  end if;
  for item in select value, ordinality from jsonb_array_elements_text(body->'cited_observation_ids') with ordinality loop
    if not exists (
      select 1 from judgment_observations link join observation_receipts obs using (observation_id)
      where link.judgment_id=target_id and obs.observation_id=item.value
        and obs.receipt_hash=body->'parent_hashes'->>((item.ordinality - 1)::integer)
        and obs.subject_type=body->>'subject_type' and obs.subject_id=body->>'subject_id'
        and obs.receipt->>'intent_hash'=body->>'intent_hash'
    ) then raise exception 'judgment_observation_binding_invalid' using errcode = '23514'; end if;
  end loop;
  return new;
end;
$$;
create constraint trigger canonical_judgment_links after insert on judgment_receipts
  deferrable initially deferred for each row execute function canonical_judgment_links_valid();
create constraint trigger canonical_join_links after insert on judgment_observations
  deferrable initially deferred for each row execute function canonical_judgment_links_valid();
create trigger observation_receipts_immutable before update or delete on observation_receipts for each row execute function canonical_receipt_immutable();
create trigger observation_receipts_no_truncate before truncate on observation_receipts for each statement execute function canonical_receipt_immutable();
create trigger judgment_receipts_immutable before update or delete on judgment_receipts for each row execute function canonical_receipt_immutable();
create trigger judgment_receipts_no_truncate before truncate on judgment_receipts for each statement execute function canonical_receipt_immutable();
create trigger execution_receipts_immutable before update or delete on execution_receipts for each row execute function canonical_receipt_immutable();
create trigger execution_receipts_no_truncate before truncate on execution_receipts for each statement execute function canonical_receipt_immutable();
create trigger evaluation_receipts_immutable before update or delete on evaluation_receipts for each row execute function canonical_receipt_immutable();
create trigger evaluation_receipts_no_truncate before truncate on evaluation_receipts for each statement execute function canonical_receipt_immutable();
create trigger judgment_observations_immutable before update or delete on judgment_observations for each row execute function canonical_receipt_immutable();
create trigger judgment_observations_no_truncate before truncate on judgment_observations for each statement execute function canonical_receipt_immutable();
commit;
