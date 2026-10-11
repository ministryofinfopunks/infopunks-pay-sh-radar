begin;
do $$ begin
  if exists (select 1 from evaluation_reviewer_attestations) then
    raise exception 'cannot_weaken_accepted_evaluation_authority';
  end if;
end $$;
alter table evaluation_receipts drop constraint evaluation_verified_review_policy;
alter table evaluation_reviewer_attestations drop constraint evaluation_attestation_fields_required;
-- Restore the original 018 function only on an empty reviewer store.
create or replace function evaluation_reviewer_attestation_matches() returns trigger language plpgsql as $$
declare att jsonb;
begin
  if new.receipt->>'policy_version' = 'review-attested-evaluation.v1' then
    select attestation into att from evaluation_reviewer_attestations
      where attestation_hash = (new.receipt->'evaluator'->>'signature_ref') and execution_id = new.execution_id;
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
commit;
