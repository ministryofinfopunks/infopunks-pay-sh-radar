begin;

-- Reviewer statements are append-only evidence sidecars. The canonical four
-- receipt JSON schemas remain unchanged; evaluator.signature_ref binds an E
-- receipt to the content hash of one row here.
create table evaluation_reviewer_attestations (
  attestation_hash text primary key check (attestation_hash ~ '^sha256:[a-f0-9]{64}$'),
  execution_id text not null unique references execution_receipts(execution_id),
  reviewer_id text not null,
  reviewer_key_id text not null,
  nonce text not null unique,
  rubric_sha256 text not null check (rubric_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  outcome_evidence_sha256 text not null check (outcome_evidence_sha256 ~ '^sha256:[a-f0-9]{64}$'),
  verdict text not null check (verdict in ('confirmed','weakened','contradicted')),
  attested_at timestamptz not null,
  attestation jsonb not null check (jsonb_typeof(attestation) = 'object'),
  check (attestation->>'schema_version' = 'evaluation-review-attestation.v1'),
  check (attestation->>'execution_receipt_id' = execution_id),
  check (attestation->>'reviewer_id' = reviewer_id),
  check (attestation->>'reviewer_key_id' = reviewer_key_id),
  check (attestation->>'nonce' = nonce),
  check (attestation->>'rubric_sha256' = rubric_sha256),
  check (attestation->>'outcome_evidence_sha256' = outcome_evidence_sha256),
  check (attestation->>'verdict' = verdict),
  check ((attestation->>'attested_at')::timestamptz = attested_at)
);
create index evaluation_reviewer_attestations_execution_idx on evaluation_reviewer_attestations(execution_id);

create trigger evaluation_reviewer_attestations_immutable before update or delete on evaluation_reviewer_attestations
  for each row execute function canonical_receipt_immutable();
create trigger evaluation_reviewer_attestations_no_truncate before truncate on evaluation_reviewer_attestations
  for each statement execute function canonical_receipt_immutable();

-- Expand the score-policy constraint only for verified reviewer-backed E rows.
alter table evaluation_receipts drop constraint evaluation_score_policy_valid;
alter table evaluation_receipts add constraint evaluation_score_policy_valid check ((
  (receipt->>'policy_version'='receipt-authority.v1' and
    (receipt->>'score_delta')::numeric = case receipt->>'outcome' when 'confirmed' then 5 when 'weakened' then -2 when 'contradicted' then -5 end)
  or (receipt->>'policy_version'='score-policy.v1' and
    (receipt->>'score_delta')::numeric = case receipt->>'outcome' when 'confirmed' then 5 when 'weakened' then -2 when 'contradicted' then -15 end
    and receipt->'evaluator'->>'verification'='internal' and receipt->'evaluator'->>'type'='internal'
    and receipt->'evaluator'->>'id' in ('canonical-admin','evaluation-service'))
  or (receipt->>'policy_version'='review-attested-evaluation.v1' and
    (receipt->>'score_delta')::numeric = case receipt->>'outcome' when 'confirmed' then 5 when 'weakened' then -2 when 'contradicted' then -15 end
    and receipt->'evaluator'->>'verification'='verified' and receipt->'evaluator'->>'type'='independent_reviewer'
    and receipt->'evaluator'->>'signature_ref' ~ '^sha256:[a-f0-9]{64}$')
) is true);

create function evaluation_reviewer_attestation_matches() returns trigger language plpgsql as $$
declare
  att jsonb;
begin
  if new.receipt->>'policy_version' = 'review-attested-evaluation.v1' then
    select attestation into att from evaluation_reviewer_attestations
      where attestation_hash = (new.receipt->'evaluator'->>'signature_ref')
        and execution_id = new.execution_id;
    if att is null then
      raise exception 'evaluation_reviewer_attestation_missing' using errcode = '23514';
    end if;
    if att->>'verdict' <> new.receipt->>'outcome'
       or (att->>'attested_at')::timestamptz > (new.receipt->>'evaluated_at')::timestamptz
       or att->'evidence_refs' <> new.receipt->'evidence_refs'
       or att->>'reviewer_id' <> new.receipt->'evaluator'->>'id' then
      raise exception 'evaluation_reviewer_attestation_binding_invalid' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger evaluation_reviewer_attestation_matches before insert on evaluation_receipts
  for each row execute function evaluation_reviewer_attestation_matches();

commit;
