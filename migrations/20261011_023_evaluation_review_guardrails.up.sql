begin;

-- 019-022 are reserved by concurrent Track A migrations. Preserve migration 018
-- byte-for-byte; this follow-up cannot fix the separate 018 numbering collision.
alter table evaluation_receipts add constraint evaluation_verified_review_policy check ((
  coalesce(receipt->'evaluator'->>'verification', '') <> 'verified'
  or receipt->>'policy_version' = 'review-attested-evaluation.v1'
) is true);

-- Existing JSON consistency checks allow SQL NULL. Require the signed fields
-- themselves to be present and equal to their indexed columns.
alter table evaluation_reviewer_attestations add constraint evaluation_attestation_fields_required check ((
  attestation->>'schema_version' = 'evaluation-review-attestation.v1'
  and attestation->>'execution_receipt_id' = execution_id
  and attestation->>'reviewer_id' = reviewer_id
  and attestation->>'reviewer_key_id' = reviewer_key_id
  and attestation->>'nonce' = nonce
  and attestation->>'rubric_sha256' = rubric_sha256
  and attestation->>'outcome_evidence_sha256' = outcome_evidence_sha256
  and attestation->>'verdict' = verdict
  and (attestation->>'attested_at')::timestamptz = attested_at
  and attestation->>'trust_registry_sha256' ~ '^sha256:[a-f0-9]{64}$'
  and attestation->>'signature' ~ '^[A-Za-z0-9+/]{86}==$'
  and jsonb_typeof(attestation->'evidence_refs') = 'array'
  and jsonb_array_length(attestation->'evidence_refs') between 1 and 32
) is true);

create or replace function evaluation_reviewer_attestation_matches() returns trigger language plpgsql as $$
declare
  att jsonb;
  execution_time timestamptz;
begin
  if new.receipt->>'policy_version' = 'review-attested-evaluation.v1' then
    select attestation into att from evaluation_reviewer_attestations
      where attestation_hash = (new.receipt->'evaluator'->>'signature_ref') and execution_id = new.execution_id;
    if att is null then
      raise exception 'evaluation_reviewer_attestation_missing' using errcode = '23514';
    end if;
    select executed_at into execution_time from execution_receipts where execution_id = new.execution_id;
    if att->>'verdict' is distinct from new.receipt->>'outcome'
       or (att->>'attested_at')::timestamptz is distinct from (new.receipt->>'evaluated_at')::timestamptz
       or att->'evidence_refs' is distinct from new.receipt->'evidence_refs'
       or att->>'reviewer_id' is distinct from new.receipt->'evaluator'->>'id'
       or (att->>'attested_at')::timestamptz < execution_time then
      raise exception 'evaluation_reviewer_attestation_binding_invalid' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
commit;
